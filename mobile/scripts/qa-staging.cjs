#!/usr/bin/env node
'use strict';

const { execSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const EXPECTED_REF = 'lvgmelaavgmyjjdggzop';
const EXPECTED_NAME = 'yard-staging';
const ROOT = path.resolve(__dirname, '../..');
const ENV_FILE = path.join(ROOT, 'mobile', '.env.development');
const run = process.argv.includes('--run');
const refIndex = process.argv.indexOf('--project-ref');
const suppliedRef = refIndex >= 0 ? process.argv[refIndex + 1] : undefined;

function die(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

if (!suppliedRef) die('Usage: node mobile/scripts/qa-staging.cjs --project-ref <staging-ref> [--run]');
if (suppliedRef !== EXPECTED_REF) die('Refused: project ref does not match the guarded staging project.');

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
  process.stdout.write('Run again with --run to create two disposable example.test users and execute the QA flow.\n');
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
const nonce = randomBytes(8).toString('hex');
const created = [];
const verifiedAbsent = new Set();
let checks = 0;
let failures = 0;
let failedCheck = null;
let cleanupFailedIds = [];

function check(label, condition) {
  checks += 1;
  if (!condition) {
    failures += 1;
    failedCheck = label;
    throw new Error(`Check failed: ${label}`);
  }
  process.stdout.write(`PASS ${label}\n`);
}

function requireNoError(label, error) {
  if (error) {
    failures += 1;
    failedCheck = label;
    const code = error.code || error.status || 'request error';
    throw new Error(`${label} (${code})`);
  }
}

function authenticatedClient(session) {
  const client = createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
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
}

async function cleanup() {
  try {
    for (const user of created) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) {
        cleanupFailedIds = created.filter((item) => !verifiedAbsent.has(item.id)).map((item) => item.id);
        process.stderr.write(`CLEANUP_FAILED user IDs: ${cleanupFailedIds.join(', ')}\n`);
        return false;
      }
      verifiedAbsent.add(user.id);
    }

    for (const user of created) {
      const { data, error } = await admin.auth.admin.getUserById(user.id);
      if (!error || error.code !== 'user_not_found' || data?.user) {
        cleanupFailedIds.push(user.id);
        process.stderr.write(`CLEANUP_VERIFY_FAILED user ID: ${user.id}\n`);
        return false;
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
        return false;
      }
    }
  } catch {
    cleanupFailedIds = created.filter((item) => !verifiedAbsent.has(item.id)).map((item) => item.id);
    process.stderr.write(`CLEANUP_FAILED user IDs: ${cleanupFailedIds.join(', ')}\n`);
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
    if (!failedCheck) {
      failedCheck = 'unexpected API error';
      failures += 1;
    }
    process.stderr.write(`FAIL ${failedCheck}\n`);
  } finally {
    const cleaned = await cleanup();
    if (!cleaned) {
      process.exitCode = 2;
      return;
    }
    if (created.length) process.stdout.write(`CLEANUP verified ${created.length} disposable users and their owned rows absent.\n`);
    process.stdout.write(`RESULT checks=${checks} failures=${failures} passes=${checks - failures} created=${created.length} cleaned=${created.length}\n`);
    if (testError) process.exitCode = 1;
  }
})().catch(() => {
  process.stderr.write('QA runner failed unexpectedly.\n');
  process.exitCode = 1;
});
