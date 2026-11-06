#!/usr/bin/env node
'use strict';

const { execSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const EXPECTED_REF = 'lvgmelaavgmyjjdggzop';
const EXPECTED_NAME = 'yard-staging';
const ROOT = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT, 'mobile', '.env.development');
const run = process.argv.includes('--run');
const chatMode = process.argv.includes('--chat');
const chatStressMode = process.argv.includes('--chat-stress');
const waitForPostgres = process.argv.includes('--wait-for-postgres');
const deleteAccountMode = process.argv.includes('--delete-account');
const refIndex = process.argv.indexOf('--project-ref');
const suppliedRef = refIndex >= 0 ? process.argv[refIndex + 1] : undefined;

function die(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

if (!suppliedRef) die('Usage: node mobile/scripts/qa-staging.cjs --project-ref <staging-ref> [--run [--chat [--wait-for-postgres [--chat-stress]]] [--delete-account]]');
if (suppliedRef !== EXPECTED_REF) die('Refused: project ref does not match the guarded staging project.');
if (chatMode && !run) die('Refused: --chat requires --run and the guarded staging project.');
if (waitForPostgres && (!run || !chatMode)) die('Refused: --wait-for-postgres requires --run --chat and the guarded staging project.');
if (chatStressMode && (!run || !chatMode || !waitForPostgres)) die('Refused: --chat-stress requires --run --chat --wait-for-postgres and the guarded staging project.');
if (deleteAccountMode && !run) die('Refused: --delete-account requires --run and the guarded staging project.');

function envValue(name) {
  if (process.env[name]) return process.env[name];
  if (!fs.existsSync(ENV_FILE)) return undefined;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equals = trimmed.indexOf('=');
    if (equals < 0 || trimmed.slice(0, equals).trim() !== name) continue;
    const raw = trimmed.slice(equals + 1).trim();
    return raw.replace(/^(['"])(.*)\1$/, '$2');
  }
}

function runCli(args) {
  // CLI stdout is captured in memory so revealed API keys never reach the terminal.
  return execSync(`npx --yes supabase ${args}`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).replace(/^\uFEFF/, '').trim();
}

function jsonCli(args) {
  return JSON.parse(runCli(args));
}

function cliKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, '');
}

let projects;
try {
  projects = jsonCli('projects list --output json');
} catch {
  die('Supabase CLI could not verify staging identity; no keys fetched and no writes performed.');
}
const project = projects.find((item) => item.id === suppliedRef);
if (!project || project.name !== EXPECTED_NAME || project.status !== 'ACTIVE_HEALTHY') {
  die('Refused: CLI project identity/status did not match the guarded staging project.');
}

const url = envValue('EXPO_PUBLIC_SUPABASE_URL');
const publicKey = envValue('EXPO_PUBLIC_SUPABASE_ANON_KEY') || envValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!url || !publicKey) die('Missing public Supabase app configuration in mobile/.env.development.');
let host;
try {
  host = new URL(url).hostname;
} catch {
  die('Supabase app URL is invalid.');
}
if (host !== `${suppliedRef}.supabase.co`) die('Refused: app URL does not match the guarded project ref.');

if (!run) {
  process.stdout.write(`Dry run OK: ${EXPECTED_NAME} (${suppliedRef}), app URL matches. No keys fetched and no writes performed.\n`);
  process.stdout.write('Run again with --run to create two disposable example.test users; add --chat for chat checks, --wait-for-postgres to await Postgres Changes readiness, --chat-stress with both flags for burst/reconnect checks, or --delete-account to exercise self-delete on one disposable user.\n');
  process.exit(0);
}

let admin;
try {
  const keys = jsonCli(`projects api-keys --remote=${cliKey(suppliedRef)} --reveal --output json`);
  const serviceRoleKey = keys.find((item) => item.name === 'service_role' && item.type === 'legacy')?.api_key;
  if (!serviceRoleKey) die('No legacy service_role key is available; no user records were created.');
  admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
} catch (error) {
  die(`Could not initialize in-memory staging Admin client (${error?.code || 'CLI/API error'}); no user records were created.`);
}

const publicClient = createClient(url, publicKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const supabaseClients = new Set([admin, publicClient]);
const nonce = randomBytes(8).toString('hex');
const created = [];
const verifiedAbsent = new Set();
const appDeletedIds = new Set();
const realtimeChannels = [];
let qaEvent = null;
let qaEventInsertAttempted = false;
let qaAvatar = null;
let checks = 0;
let failures = 0;
let failedCheck = null;
let activePhase = 'staging QA flow';
let failureRecorded = false;
let cleanupFailedIds = [];
const chatStressChecks = [];
let chatStressEvidencePath = null;

function check(label, condition) {
  checks += 1;
  if (!condition) {
    failures += 1;
    failedCheck = label;
    failureRecorded = true;
    throw new Error(`Check failed: ${label}`);
  }
  process.stdout.write(`PASS ${label}\n`);
}

function requireNoError(label, error) {
  if (error) {
    failures += 1;
    failedCheck = label;
    failureRecorded = true;
    const code = error.code || error.status || 'request error';
    throw new Error(`${label} (${code})`);
  }
}

function authenticatedClient(session) {
  const client = createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  supabaseClients.add(client);
  return client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }).then(({ error }) => {
    requireNoError('restore session in fresh client', error);
    return client;
  });
}

async function createAndLogin(index) {
  const email = `yard-qa-${nonce}-${index}@example.test`;
  const password = randomBytes(32).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { qa_run: nonce },
  });
  requireNoError(`create disposable user ${index}`, error);
  if (!data.user?.id) throw new Error(`create disposable user ${index} returned no id`);
  const user = { id: data.user.id, email };
  created.push(user);

  // generateLink returns an OTP for our custom verification call and does not send an email.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  requireNoError(`generate local sign-in token ${index}`, linkError);
  const code = link?.properties?.email_otp;
  const tokenHash = link?.properties?.hashed_token;
  if (!code && !tokenHash) throw new Error(`generate local sign-in token ${index} returned no token`);
  const verified = code
    ? await publicClient.auth.verifyOtp({ email, token: code, type: 'email' })
    : await publicClient.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  requireNoError(`verify sign-in token ${index}`, verified.error);
  if (!verified.data.session) throw new Error(`verify sign-in token ${index} returned no session`);
  return { ...user, session: verified.data.session };
}

async function profileFor(client, id) {
  const result = await client
    .from('profiles')
    .select('id, username, display_name, bio, home_city_id, profile_interests(interests(id, slug, label, symbol))')
    .eq('id', id)
    .maybeSingle();
  requireNoError('read own profile', result.error);
  return result.data;
}

async function checkSelfDelete(user, client) {
  activePhase = 'authenticated self-delete';
  const avatarName = `qa-${nonce}.png`;
  qaAvatar = { userId: user.id, name: avatarName, path: `${user.id}/${avatarName}` };
  const avatarPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const { error: uploadError } = await client.storage.from('avatars').upload(qaAvatar.path, avatarPng, {
    contentType: 'image/png',
    upsert: false,
  });
  requireNoError('upload disposable avatar as authenticated user', uploadError);
  const { data: uploadedFiles, error: uploadCheckError } = await admin.storage.from('avatars').list(user.id, {
    search: avatarName,
    limit: 10,
  });
  requireNoError('verify exact disposable avatar exists', uploadCheckError);
  check('disposable avatar upload is stored', uploadedFiles?.some((file) => file.name === avatarName));

  process.stdout.write('Calling delete-account as the first runner-created disposable user.\n');
  const { data, error } = await client.functions.invoke('delete-account');
  requireNoError('call delete-account as disposable user', error);
  check('delete-account function confirms deletion', data?.ok === true);

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(user.id);
  check('self-delete removes the Auth user', authError?.code === 'user_not_found' && !authUser?.user);

  const ownedRows = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', user.id),
    admin.from('profiles_private').select('id', { count: 'exact', head: true }).eq('id', user.id),
    admin.from('profile_interests').select('profile_id', { count: 'exact', head: true }).eq('profile_id', user.id),
    admin.from('rsvps').select('user_id', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('friendships').select('user_a', { count: 'exact', head: true }).or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    admin.from('blocks').select('blocker_id', { count: 'exact', head: true }).or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('reporter_id', user.id),
    admin.from('notifications').select('id', { count: 'exact', head: true }).or(`user_id.eq.${user.id},actor_id.eq.${user.id}`),
    admin.from('device_tokens').select('token', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('event_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('event_chat_reads').select('event_id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  check('self-delete removes all profile-owned rows', ownedRows.every((result) => !result.error && result.count === 0));

  const { data: avatarFiles, error: avatarError } = await admin.storage.from('avatars').list(user.id, {
    search: avatarName,
    limit: 10,
  });
  requireNoError('verify self-delete removes avatar files', avatarError);
  check(
    'self-delete removes the exact uploaded avatar',
    Array.isArray(avatarFiles) && !avatarFiles.some((file) => file.name === avatarName),
  );
  appDeletedIds.add(user.id);
}

async function checkChatStressRealtime(users, clients, eventId) {
  const [sender, recipient] = clients;
  const priorChannels = realtimeChannels.filter((entry) => entry.client === recipient && !entry.removed);
  const stressCheck = (label, condition) => {
    const passed = Boolean(condition);
    chatStressChecks.push({ check: label, passed });
    check(`chat stress: ${label}`, passed);
  };
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const bounded = (promise, label, milliseconds) => {
    activePhase = label;
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      }),
    ]).finally(() => clearTimeout(timer));
  };
  const waitFor = async (predicate, label, milliseconds = 15000) => {
    activePhase = label;
    const deadline = Date.now() + milliseconds;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await delay(100);
    }
    throw new Error(`${label} timed out`);
  };

  stressCheck('existing recipient subscription available for disconnect', priorChannels.length === 1);
  const priorEntry = priorChannels[0];
  const removed = await recipient.removeChannel(priorEntry.channel);
  priorEntry.removed = removed === 'ok';
  stressCheck('recipient unsubscribes before reconnect gap', priorEntry.removed);

  const topic = `qa-chat:${eventId}`;
  const openSubscription = async (phase) => {
    const received = [];
    let subscribedResolve;
    let subscribedReject;
    const subscribed = new Promise((resolve, reject) => {
      subscribedResolve = resolve;
      subscribedReject = reject;
    });
    let status = 'CREATED';
    let channel;
    const options = { config: { postgres_changes_options: { wait: true } } };
    channel = recipient.channel(topic, options)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_messages',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const row = payload.new || {};
        received.push(row);
        process.stdout.write(`CHAT_STRESS_REALTIME event_id=${row.event_id || 'unknown'} message_id=${row.id ?? 'unknown'}\n`);
      })
      .subscribe((nextStatus) => {
        status = nextStatus;
        process.stdout.write(`CHAT_STRESS_REALTIME phase=${phase} status=${status}\n`);
        if (status === 'SUBSCRIBED') subscribedResolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          subscribedReject(new Error(`chat stress subscription ${status}`));
        }
      });
    const entry = { client: recipient, channel, removed: false };
    realtimeChannels.push(entry);
    await bounded(subscribed, `${phase} readiness`, 15000);
    stressCheck(`${phase} server-confirmed Postgres readiness`, status === 'SUBSCRIBED');
    return { channel, entry, received };
  };

  const live = await openSubscription('burst');
  const burstBodies = Array.from({ length: 5 }, (_, index) => `QA stress burst ${nonce} ${index + 1}`);
  const inserted = [];
  activePhase = 'chat stress ordered burst inserts';
  for (let index = 0; index < burstBodies.length; index += 1) {
    const { data, error } = await sender.from('event_messages').insert({
      event_id: eventId,
      user_id: users[0].id,
      body: burstBodies[index],
    }).select('id, body').single();
    requireNoError(`insert stress burst message ${index + 1}`, error);
    inserted.push(data);
    stressCheck(`burst message ${index + 1} persisted`, data?.body === burstBodies[index] && data?.id != null);
  }
  await waitFor(() => inserted.every((row) => live.received.some((message) => message.id === row.id)), 'ordered burst realtime delivery');
  const deliveredBurst = live.received.filter((message) => inserted.some((row) => row.id === message.id));
  stressCheck('five-message burst arrives once and in insert order',
    deliveredBurst.length === inserted.length && deliveredBurst.every((row, index) => row.id === inserted[index].id));

  const burstHistory = await recipient.rpc('get_chat_messages', { p_event_id: eventId, p_before_id: null, p_limit: 50 });
  requireNoError('read recipient history after stress burst', burstHistory.error);
  const historyBurstBodies = (burstHistory.data ?? []).filter((row) => burstBodies.includes(row.body)).map((row) => row.body);
  stressCheck('history returns burst in newest-first order',
    JSON.stringify(historyBurstBodies) === JSON.stringify([...burstBodies].reverse()));

  const gapRemoved = await recipient.removeChannel(live.channel);
  live.entry.removed = gapRemoved === 'ok';
  stressCheck('recipient unsubscribes for reconnect gap', live.entry.removed);
  const missedBody = `QA stress reconnect gap ${nonce}`;
  const missedInsert = await sender.from('event_messages').insert({
    event_id: eventId,
    user_id: users[0].id,
    body: missedBody,
  }).select('id, body').single();
  requireNoError('insert message during recipient disconnect', missedInsert.error);
  stressCheck('disconnect-gap message persisted', missedInsert.data?.body === missedBody && missedInsert.data?.id != null);

  const reconnected = await openSubscription('reconnect');
  const caughtUp = await recipient.rpc('get_chat_messages', { p_event_id: eventId, p_before_id: null, p_limit: 50 });
  requireNoError('read recipient history after reconnect', caughtUp.error);
  stressCheck('history catches up message sent while unsubscribed',
    caughtUp.data?.some((row) => row.id === missedInsert.data?.id && row.body === missedBody));

  const liveBody = `QA stress post-reconnect live ${nonce}`;
  const liveInsert = await sender.from('event_messages').insert({
    event_id: eventId,
    user_id: users[0].id,
    body: liveBody,
  }).select('id, body').single();
  requireNoError('insert message after recipient reconnect', liveInsert.error);
  stressCheck('post-reconnect live message persisted', liveInsert.data?.body === liveBody && liveInsert.data?.id != null);
  await waitFor(() => reconnected.received.some((row) => row.id === liveInsert.data?.id), 'post-reconnect realtime delivery');
  stressCheck('recipient receives live message after reconnect',
    reconnected.received.some((row) => row.id === liveInsert.data?.id && row.body === liveBody));
}

async function checkChatRsvpRealtime(users, clients, cityId) {
  const eventId = randomUUID();
  const eventTitle = `QA chat ${nonce}`;
  const externalId = `qa-chat-${nonce}`;
  qaEvent = { id: eventId, title: eventTitle, externalId };

  const { data: prior, error: priorError } = await admin.from('events').select('id').eq('id', eventId).maybeSingle();
  requireNoError('check QA event UUID is unused', priorError);
  check('QA event UUID is unused before insert', !prior);
  process.stdout.write(`QA fixture event ID: ${eventId}\n`);

  // Record the exact UUID before the request so cleanup can handle an ambiguous network result safely.
  qaEventInsertAttempted = true;
  const { data: event, error: eventError } = await admin.from('events').insert({
    id: eventId,
    source: 'curated',
    external_id: externalId,
    city_id: cityId,
    title: eventTitle,
    starts_at: '2099-08-20T23:00:00.000Z',
    ends_at: '2099-08-21T03:00:00.000Z',
    venue_name: 'QA Charlotte Venue',
    venue_address: 'Charlotte, NC',
    neighborhood: 'Uptown',
    location: 'SRID=4326;POINT(-80.8431 35.2271)',
    is_free: true,
    status: 'active',
  }).select('id, starts_at, status').single();
  requireNoError('create isolated QA event fixture', eventError);
  check('QA event fixture is active and outside the feed window',
    event?.id === eventId && event?.status === 'active' && Date.parse(event?.starts_at) === Date.parse('2099-08-20T23:00:00.000Z'));

  const [sender, recipient] = clients;
  const recipientRsvp = await recipient.rpc('set_rsvp', { p_event_id: eventId, p_status: 'going' });
  requireNoError('recipient RSVPs Going', recipientRsvp.error);
  const recipientState = await recipient.from('rsvps').select('status').eq('event_id', eventId).eq('user_id', users[1].id).maybeSingle();
  requireNoError('read recipient RSVP', recipientState.error);
  check('recipient Going membership persisted', recipientState.data?.status === 'going');

  const outsiderAttempt = await sender.from('event_messages').insert({
    event_id: eventId,
    user_id: users[0].id,
    body: `QA outsider ${nonce}`,
  });
  check('non-Going user cannot post to chat', outsiderAttempt.error?.code === '42501');

  const senderRsvp = await sender.rpc('set_rsvp', { p_event_id: eventId, p_status: 'going' });
  requireNoError('sender RSVPs Going', senderRsvp.error);
  const senderChats = await sender.rpc('get_my_chats');
  requireNoError('read sender chat list after Going', senderChats.error);
  check('Going user receives the event chat', senderChats.data?.some((row) => row.event_id === eventId));

  let subscribedResolve;
  let subscribedReject;
  const subscribed = new Promise((resolve, reject) => {
    subscribedResolve = resolve;
    subscribedReject = reject;
  });
  let messageResolve;
  const realtimeMessage = new Promise((resolve) => { messageResolve = resolve; });
  const realtimeStartedAt = process.hrtime.bigint();
  const elapsedRealtimeMs = () => Math.round(Number(process.hrtime.bigint() - realtimeStartedAt) / 1e6);
  const logRealtime = (details) => process.stdout.write(`REALTIME elapsed_ms=${elapsedRealtimeMs()} ${details}\n`);
  let realtimeStatus = 'CREATED';
  let channel;
  const channelOptions = waitForPostgres ? { config: { postgres_changes_options: { wait: true } } } : undefined;
  process.stdout.write(`Realtime Postgres readiness wait: ${waitForPostgres ? 'enabled' : 'disabled'}\n`);
  const newChannel = channelOptions
    ? recipient.channel(`qa-chat:${eventId}`, channelOptions)
    : recipient.channel(`qa-chat:${eventId}`);
  channel = newChannel
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`,
    }, (payload) => {
      const row = payload.new || {};
      logRealtime(`callback event_id=${row.event_id || 'unknown'} message_id=${row.id ?? 'unknown'} created_at=${row.created_at || 'unknown'} commit_timestamp=${payload.commit_timestamp || 'unknown'} channel_state=${channel?.state || 'unknown'}`);
      messageResolve(row);
    })
    .subscribe((status) => {
      realtimeStatus = status;
      logRealtime(`status=${status} channel_state=${channel?.state || 'unknown'}`);
      if (status === 'SUBSCRIBED') subscribedResolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        subscribedReject(new Error(`Realtime subscription ${status}`));
      }
    });
  const realtimeEntry = { client: recipient, channel, removed: false };
  realtimeChannels.push(realtimeEntry);

  const bounded = (promise, label, milliseconds) => {
    activePhase = label;
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      }),
    ]).finally(() => clearTimeout(timer));
  };
  await bounded(subscribed, 'Realtime subscription', 15000);
  logRealtime(`subscribed_ack status=${realtimeStatus} channel_state=${channel.state}`);
  check('recipient realtime channel subscribed', true);

  const body = `QA realtime message ${nonce}`;
  logRealtime(`insert_start event_id=${eventId} channel_state=${channel.state}`);
  const inserted = await sender.from('event_messages').insert({
    event_id: eventId,
    user_id: users[0].id,
    body,
  }).select('id, body, created_at').single();
  requireNoError('insert QA chat message as member', inserted.error);
  logRealtime(`insert_response event_id=${eventId} message_id=${inserted.data?.id ?? 'unknown'} created_at=${inserted.data?.created_at || 'unknown'} channel_state=${channel.state}`);
  check('chat message insert persisted', Boolean(inserted.data?.id) && inserted.data?.body === body);

  // Verify PostgREST history independently before waiting on the Realtime delivery path.
  const history = await recipient.rpc('get_chat_messages', { p_event_id: eventId, p_before_id: null, p_limit: 50 });
  requireNoError('read chat history as recipient', history.error);
  const historyHasMessage = history.data?.some((row) => row.id === inserted.data.id && row.body === body) ?? false;
  logRealtime(`history_check event_id=${eventId} message_id=${inserted.data?.id ?? 'unknown'} visible=${historyHasMessage} channel_state=${channel.state}`);
  check('recipient reads persisted chat message', historyHasMessage);

  let delivered;
  try {
    delivered = await bounded(realtimeMessage, 'Recipient realtime INSERT', 15000);
  } catch (error) {
    const assertionPhase = activePhase;
    logRealtime(`deadline=15s status=${realtimeStatus} channel_state=${channel.state}`);
    let arrivedLate = false;
    try {
      delivered = await bounded(realtimeMessage, 'Late recipient realtime INSERT', 30000);
      arrivedLate = true;
    } catch {
      // Keep the original 15-second assertion failure after observing the extra window.
    }
    activePhase = assertionPhase;
    logRealtime(`extra_window=30s result=${arrivedLate ? 'late' : 'absent'} status=${realtimeStatus} channel_state=${channel.state}`);
    throw error;
  }
  check('recipient receives realtime INSERT', delivered?.id === inserted.data?.id && delivered?.body === body);

  if (chatStressMode) await checkChatStressRealtime(users, clients, eventId);

  const erased = await sender.from('event_messages').update({ deleted_at: new Date().toISOString() })
    .eq('id', inserted.data.id).select('id').single();
  requireNoError('soft-delete own QA message', erased.error);
  const afterDelete = await recipient.rpc('get_chat_messages', { p_event_id: eventId, p_before_id: null, p_limit: 50 });
  requireNoError('read history after QA message deletion', afterDelete.error);
  check('soft delete erases the message body', afterDelete.data?.some((row) => row.id === inserted.data.id && row.body === null));

  const leave = await sender.rpc('set_rsvp', { p_event_id: eventId, p_status: 'interested' });
  requireNoError('sender leaves Going membership', leave.error);
  const chatsAfterLeave = await sender.rpc('get_my_chats');
  requireNoError('read chat list after leaving Going', chatsAfterLeave.error);
  check('leaving Going removes the chat from the list', !chatsAfterLeave.data?.some((row) => row.event_id === eventId));
  const historyAfterLeave = await sender.rpc('get_chat_messages', { p_event_id: eventId, p_before_id: null, p_limit: 50 });
  requireNoError('read history after leaving Going', historyAfterLeave.error);
  check('leaving Going hides prior chat messages', historyAfterLeave.data?.length === 0);
  const postAfterLeave = await sender.from('event_messages').insert({
    event_id: eventId,
    user_id: users[0].id,
    body: `QA after leaving ${nonce}`,
  });
  check('leaving Going prevents further chat posts', postAfterLeave.error?.code === '42501');
}

async function main() {
  process.stdout.write(`Running disposable QA against ${EXPECTED_NAME}; credentials remain in memory.\n`);
  const { data: city, error: cityError } = await publicClient.from('cities').select('id').eq('slug', 'charlotte').maybeSingle();
  requireNoError('look up Charlotte city id', cityError);
  check('Charlotte city exists', Boolean(city?.id));
  const { data: interests, error: interestError } = await publicClient.from('interests').select('id').order('id').limit(3);
  requireNoError('look up three interest ids', interestError);
  check('at least three interests exist', Boolean(interests && interests.length === 3));
  const interestIds = interests.map((interest) => interest.id);

  const users = [await createAndLogin(1), await createAndLogin(2)];
  const clients = await Promise.all(users.map((user) => authenticatedClient(user.session)));
  for (const [index, client] of clients.entries()) {
    const { data: authData, error: authError } = await client.auth.getUser();
    requireNoError(`confirm authenticated user ${index + 1}`, authError);
    check(`user ${index + 1} session verified`, authData.user?.id === users[index].id);
  }

  const profiles = [];
  for (const [index, client] of clients.entries()) {
    const username = `qa_${nonce.slice(0, 8)}_${index + 1}`;
    const { data: available, error: availableError } = await client.rpc('username_available', { p_username: username });
    requireNoError(`check unique username ${index + 1}`, availableError);
    check(`username ${index + 1} available`, available === true);
    const { error: onboardingError } = await client.rpc('complete_onboarding', {
      p_username: username,
      p_display_name: `QA ${nonce.slice(0, 6)} ${index + 1}`,
      p_birthdate: '1990-01-01',
      p_interest_ids: interestIds,
      p_home_city_id: city.id,
    });
    requireNoError(`onboard user ${index + 1}`, onboardingError);
    check(`user ${index + 1} onboarding persisted`, (await profileFor(client, users[index].id))?.username === username);
    profiles.push({ username, updatedUsername: `${username}_u` });
  }

  for (const [index, client] of clients.entries()) {
    const { error: updateError } = await client.rpc('update_my_profile', {
      p_display_name: `QA Updated ${index + 1}`,
      p_username: profiles[index].updatedUsername,
      p_bio: 'Staging persistence check',
      p_interest_ids: interestIds,
    });
    requireNoError(`update profile ${index + 1}`, updateError);
    const fresh = await authenticatedClient(users[index].session);
    const persisted = await profileFor(fresh, users[index].id);
    check(`profile ${index + 1} update persists across a fresh client`,
      persisted?.username === profiles[index].updatedUsername && persisted?.bio === 'Staging persistence check');
  }

  const [requester, recipient] = clients;
  const { data: sent, error: sendError } = await requester.rpc('send_friend_request', { p_user: users[1].id });
  requireNoError('send friend request', sendError);
  check('friend request sent', sent === 'outgoing');
  const { data: outgoing, error: outgoingError } = await requester.rpc('list_friend_requests');
  requireNoError('read outgoing friend request', outgoingError);
  const { data: incoming, error: incomingError } = await recipient.rpc('list_friend_requests');
  requireNoError('read incoming friend request', incomingError);
  check('friend request visible to both test users',
    outgoing?.some((request) => request.id === users[1].id && request.direction === 'outgoing') &&
    incoming?.some((request) => request.id === users[0].id && request.direction === 'incoming'));
  const { data: accepted, error: acceptError } = await recipient.rpc('respond_friend_request', {
    p_user: users[0].id,
    p_accept: true,
  });
  requireNoError('accept friend request', acceptError);
  check('friend request accepted', accepted === 'friends');
  const { data: requesterFriends, error: requesterFriendsError } = await requester.rpc('list_friends');
  requireNoError('read requester friends', requesterFriendsError);
  const { data: recipientFriends, error: recipientFriendsError } = await recipient.rpc('list_friends');
  requireNoError('read recipient friends', recipientFriendsError);
  check('friendship persisted for both users',
    requesterFriends?.some((friend) => friend.id === users[1].id) && recipientFriends?.some((friend) => friend.id === users[0].id));

  const { error: blockError } = await requester.from('blocks').insert({ blocker_id: users[0].id, blocked_id: users[1].id });
  requireNoError('block test user', blockError);
  const { data: blocked, error: blockedError } = await requester.rpc('list_my_blocks');
  requireNoError('read blocked users', blockedError);
  const { data: friendsAfterBlock, error: friendsAfterBlockError } = await requester.rpc('list_friends');
  requireNoError('read friends after block', friendsAfterBlockError);
  check('block persisted and friend list is hidden',
    blocked?.some((person) => person.id === users[1].id) && friendsAfterBlock?.length === 0);
  const { data: hidden, error: hiddenError } = await recipient.rpc('search_profiles', { p_query: profiles[0].updatedUsername, p_limit: 20 });
  requireNoError('search for blocking user', hiddenError);
  check('block hides profile from search', hidden?.length === 0);

  const { error: unblockError } = await requester.from('blocks').delete().eq('blocker_id', users[0].id).eq('blocked_id', users[1].id);
  requireNoError('unblock test user', unblockError);
  const { data: unblocked, error: unblockedError } = await requester.rpc('list_my_blocks');
  requireNoError('read block list after unblock', unblockedError);
  const { data: visible, error: visibleError } = await recipient.rpc('search_profiles', { p_query: profiles[0].updatedUsername, p_limit: 20 });
  requireNoError('search after unblock', visibleError);
  check('unblock restores profile search visibility', !unblocked?.some((person) => person.id === users[1].id) && visible?.some((person) => person.id === users[0].id));

  if (chatMode) await checkChatRsvpRealtime(users, clients, city.id);
  if (deleteAccountMode) await checkSelfDelete(users[0], clients[0]);
}

async function cleanup() {
  try {
    for (const { client, channel } of realtimeChannels) {
      if (realtimeChannels.find((entry) => entry.channel === channel)?.removed) continue;
      try {
        await client.removeChannel(channel);
      } catch {
        cleanupFailedIds.push(`channel:${qaEvent?.id || 'qa'}`);
        process.stderr.write(`CLEANUP_FAILED realtime channel for QA event: ${qaEvent?.id || 'unknown'}\n`);
      }
    }
    if (qaEvent && qaEventInsertAttempted) {
      const { error } = await admin.from('events').delete().eq('id', qaEvent.id);
      if (error) {
        cleanupFailedIds.push(`event:${qaEvent.id}`);
        process.stderr.write(`CLEANUP_FAILED QA event ID: ${qaEvent.id}\n`);
      } else {
        const [eventCheck, messageCheck, rsvpCheck, readCheck] = await Promise.all([
          admin.from('events').select('id', { count: 'exact', head: true }).eq('id', qaEvent.id),
          admin.from('event_messages').select('id', { count: 'exact', head: true }).eq('event_id', qaEvent.id),
          admin.from('rsvps').select('event_id', { count: 'exact', head: true }).eq('event_id', qaEvent.id),
          admin.from('event_chat_reads').select('event_id', { count: 'exact', head: true }).eq('event_id', qaEvent.id),
        ]);
        if ([eventCheck, messageCheck, rsvpCheck, readCheck].some((result) => result.error || result.count !== 0)) {
          cleanupFailedIds.push(`event:${qaEvent.id}`);
          process.stderr.write(`CLEANUP_VERIFY_FAILED QA event ID: ${qaEvent.id}\n`);
        }
      }
    }
    if (qaAvatar && !appDeletedIds.has(qaAvatar.userId)) {
      let avatarCleanupFailed = false;
      try {
        const { error } = await admin.storage.from('avatars').remove([qaAvatar.path]);
        if (error) avatarCleanupFailed = true;
        if (!avatarCleanupFailed) {
          const { data, error: verifyError } = await admin.storage.from('avatars').list(qaAvatar.userId, {
            search: qaAvatar.name,
            limit: 10,
          });
          avatarCleanupFailed = Boolean(
            verifyError || !Array.isArray(data) || data.some((file) => file.name === qaAvatar.name),
          );
        }
      } catch {
        avatarCleanupFailed = true;
      }
      if (avatarCleanupFailed) {
        cleanupFailedIds.push(`avatar:${qaAvatar.path}`);
        process.stderr.write(`CLEANUP_FAILED tracked avatar path: ${qaAvatar.path}\n`);
      }
    }
    for (const user of created) {
      if (appDeletedIds.has(user.id)) {
        verifiedAbsent.add(user.id);
        continue;
      }
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error && error.code !== 'user_not_found') {
        cleanupFailedIds.push(user.id);
        process.stderr.write(`CLEANUP_FAILED user ID: ${user.id}\n`);
      } else {
        verifiedAbsent.add(user.id);
      }
    }
    // Supabase schedules idle Realtime disconnects; force every client socket closed so Node can exit now.
    await Promise.allSettled([...supabaseClients].map((client) => client.removeAllChannels()));

    for (const user of created) {
      if (!verifiedAbsent.has(user.id)) continue;
      const { data, error } = await admin.auth.admin.getUserById(user.id);
      if (!error || error.code !== 'user_not_found' || data?.user) {
        cleanupFailedIds.push(user.id);
        process.stderr.write(`CLEANUP_VERIFY_FAILED user ID: ${user.id}\n`);
        continue;
      }
      const tableChecks = await Promise.all([
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', user.id),
        admin.from('profiles_private').select('id', { count: 'exact', head: true }).eq('id', user.id),
        admin.from('profile_interests').select('profile_id', { count: 'exact', head: true }).eq('profile_id', user.id),
        admin.from('friendships').select('user_a', { count: 'exact', head: true }).or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
        admin.from('blocks').select('blocker_id', { count: 'exact', head: true }).or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
        admin.from('notifications').select('id', { count: 'exact', head: true }).or(`user_id.eq.${user.id},actor_id.eq.${user.id}`),
      ]);
      if (tableChecks.some((result) => result.error || result.count !== 0)) {
        cleanupFailedIds.push(user.id);
        process.stderr.write(`CLEANUP_VERIFY_FAILED user ID: ${user.id}\n`);
        continue;
      }
    }
  } catch {
    for (const user of created) if (!verifiedAbsent.has(user.id) && !cleanupFailedIds.includes(user.id)) cleanupFailedIds.push(user.id);
    if (qaEventInsertAttempted && !cleanupFailedIds.some((id) => id.startsWith('event:'))) cleanupFailedIds.push(`event:${qaEvent.id}`);
    process.stderr.write(`CLEANUP_FAILED tracked IDs: ${cleanupFailedIds.join(', ')}\n`);
    return false;
  }
  if (cleanupFailedIds.length) {
    process.stderr.write(`CLEANUP_FAILED tracked IDs: ${cleanupFailedIds.join(', ')}\n`);
    return false;
  }
  return true;
}

(async () => {
  let testError = null;
  try {
    await main();
  } catch (error) {
    testError = error;
    if (!failureRecorded) {
      failedCheck = activePhase;
      checks += 1;
      failures += 1;
      failureRecorded = true;
    }
    process.stderr.write(`FAIL ${failedCheck}\n`);
  } finally {
    const cleaned = await cleanup();
    if (chatStressMode) {
      chatStressEvidencePath = path.join(os.tmpdir(), `yard-chat-stress-${Date.now()}-${process.pid}.json`);
      const evidence = {
        project: EXPECTED_NAME,
        suite: 'chat-stress',
        completed_at: new Date().toISOString(),
        status: testError ? 'failed' : cleaned ? 'passed' : 'cleanup_failed',
        checks: chatStressChecks,
        totals: {
          checks: chatStressChecks.length,
          passed: chatStressChecks.filter((item) => item.passed).length,
          failed: chatStressChecks.filter((item) => !item.passed).length,
        },
        failed_check: failedCheck,
        cleanup_verified: cleaned,
      };
      try {
        fs.writeFileSync(chatStressEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
        process.stdout.write(`CHAT_STRESS_EVIDENCE ${chatStressEvidencePath}\n`);
      } catch {
        process.stderr.write('CHAT_STRESS_EVIDENCE_WRITE_FAILED\n');
      }
    }
    if (!cleaned) {
      process.exitCode = 2;
      return;
    }
    if (qaEventInsertAttempted && !cleanupFailedIds.some((id) => id.startsWith('event:'))) {
      process.stdout.write(`CLEANUP verified QA event ${qaEvent.id}, messages, RSVPs and read markers absent.\n`);
    }
    if (created.length && !created.some((user) => cleanupFailedIds.includes(user.id))) {
      process.stdout.write(`CLEANUP verified ${created.length} disposable users and their owned rows absent.\n`);
    }
    process.stdout.write(`RESULT checks=${checks} failures=${failures} passes=${checks - failures} created=${created.length} cleaned=${verifiedAbsent.size} chat=${chatMode ? 'yes' : 'no'} chat_stress=${chatStressMode ? 'yes' : 'no'} wait_for_postgres=${waitForPostgres ? 'yes' : 'no'} delete_account=${deleteAccountMode ? 'yes' : 'no'}\n`);
    if (testError) process.exitCode = 1;
  }
})().catch(() => {
  process.stderr.write('QA runner failed unexpectedly.\n');
  process.exitCode = 1;
});
