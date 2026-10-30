import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TokenVault, parseKey } from '../core/crypto-vault.mjs';
import { JsonStore } from '../core/store.mjs';
import { DraftService } from '../core/drafts.mjs';
import { ApprovalService } from '../core/approvals.mjs';
import { MetaApiError, MetaClient } from '../core/meta-client.mjs';
import { OAuthFlow } from '../core/oauth.mjs';
import { TextProvider } from '../core/provider.mjs';
import { DiscoveryService } from '../core/discovery.mjs';
import { EventReviewService } from '../core/event-review.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const source = resolve(root, 'marketing/content/launch-drafts.json');

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'yard-marketing-'));
  const store = new JsonStore(join(directory, 'state.json'));
  await store.initialize();
  const drafts = new DraftService({
    store, contentPath: source,
    mediaDir: resolve(root, 'marketing/preview/media'),
    jpegMediaDir: resolve(root, 'marketing/preview/media/jpeg'),
    reelsDir: resolve(root, 'marketing/reels'),
  });
  await drafts.initialize();
  return { directory, store, drafts };
}

const connectedState = async (store) => store.transaction((state) => {
  state.accounts = [
    { id: 'facebook:page-42', platform: 'facebook', pageId: 'page-42', name: 'Test Page', tasks: ['CREATE_CONTENT'], connected: true },
    { id: 'instagram:ig-42', platform: 'instagram', pageId: 'page-42', instagramUserId: 'ig-42', name: 'Test Page', accountType: 'professional', tasks: ['CREATE_CONTENT'], connected: true },
  ];
});

const oauth = {
  async tokenBundle() {
    return { permissions: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'], pages: [{ id: 'page-42', tasks: ['CREATE_CONTENT'], pageAccessToken: 'test-only-token' }] };
  },
};

async function addEventCandidate(store, id = 'candidate-event-1') {
  await store.transaction((state) => {
    state.discoveryCandidates.push({
      id, sourcePlatform: 'instagram', sourcePostId: 'DfDVAQII9K7', sourceUsername: 'campnorthend', sourceHashtag: null,
      sourcePermalink: 'https://www.instagram.com/p/DfDVAQII9K7/', caption: 'Source copy must not become event copy.',
      postedAt: '2026-10-28T12:00:00.000Z', reviewStatus: 'unreviewed',
    });
  });
}

async function completeEventDraft(service, draft, overrides = {}) {
  return service.update(draft.id, {
    expectedRevision: draft.revision,
    title: "Festival Día de Muertos: O'Fallon's Night",
    starts_at: '2026-11-01T12:00:00-05:00', ends_at: '2026-11-01T18:00:00-05:00',
    venue: 'Camp North End — Ford Building / Boileryard',
    address: "300 Camp Rd, Charlotte, NC 28206",
    details: 'A family-friendly afternoon at Camp North End with music and activities.',
    evidenceNotes: 'Campus-level coordinate only; not a precise entrance.',
    referenceUrls: ['https://officialdiademuertosclt.org/'],
    ...overrides,
  });
}

test('AES-GCM tokens decrypt with the previous key and can rotate to the current key', () => {
  const previous = parseKey('1'.repeat(64), 'old');
  const current = parseKey('2'.repeat(64), 'new');
  const oldVault = new TokenVault({ current: previous });
  const envelope = oldVault.encrypt({ accessToken: 'never-return-this' });
  const rotated = new TokenVault({ current, previous }).encrypt(new TokenVault({ current, previous }).decrypt(envelope));
  assert.equal(rotated.keyId, 'new');
  assert.deepEqual(new TokenVault({ current }).decrypt(rotated), { accessToken: 'never-return-this' });
  assert.throws(() => new TokenVault({ current }).decrypt(envelope), { code: 'token_key_missing' });
});

test('Meta adapter pins v26.0 paths and encodes Facebook and Instagram publish contracts', async () => {
  const seen = [];
  const client = new MetaClient({ config: { graphVersion: 'v26.0', appId: 'test-app', appSecret: 'test-secret', redirectUri: 'http://127.0.0.1:4317/oauth/meta/callback', scopes: [], oauthReady: true }, fetchImpl: async (url, options = {}) => {
    seen.push({ url: new URL(url), method: options.method, body: new URLSearchParams(options.body || '') });
    return new Response(JSON.stringify({ id: 'remote-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  await client.publishFacebookFeed({ pageId: 'page-42', pageToken: 'private', message: 'Caption', attachedMedia: ['photo-a', 'photo-b'] });
  await client.createInstagramCarousel({ instagramUserId: 'ig-42', pageToken: 'private', children: ['child-a', 'child-b'], caption: 'Caption' });
  await client.publishInstagramContainer('ig-42', 'container-9', 'private');
  await client.getInstagramBusinessDiscovery({ instagramUserId: 'ig-42', userToken: 'user-only-token', username: 'charlottecoffee' });
  await client.searchInstagramHashtag({ instagramUserId: 'ig-42', userToken: 'user-only-token', hashtag: 'cltevents' });
  await client.getInstagramHashtagRecentMedia({ instagramUserId: 'ig-42', userToken: 'user-only-token', hashtagId: 'hashtag-9' });
  await client.debugUserAccessToken('user-token-to-validate');
  assert.equal(seen[0].url.pathname, '/v26.0/page-42/feed');
  assert.equal(seen[0].body.get('message'), 'Caption');
  assert.deepEqual(JSON.parse(seen[0].body.get('attached_media')), [{ media_fbid: 'photo-a' }, { media_fbid: 'photo-b' }]);
  assert.equal(seen[1].url.pathname, '/v26.0/ig-42/media');
  assert.equal(seen[1].body.get('media_type'), 'CAROUSEL');
  assert.equal(seen[1].body.get('children'), 'child-a,child-b');
  assert.equal(seen[2].url.pathname, '/v26.0/ig-42/media_publish');
  assert.equal(seen[2].body.get('creation_id'), 'container-9');
  assert.equal(seen[3].url.pathname, '/v26.0/ig-42');
  assert.equal(seen[3].url.searchParams.get('access_token'), 'user-only-token');
  assert.match(seen[3].url.searchParams.get('fields'), /business_discovery\.username\(charlottecoffee\).*media\.limit\(25\)/);
  assert.match(seen[3].url.searchParams.get('fields'), /id,caption,permalink,timestamp,media_type,media_url/);
  assert.equal(seen[4].url.pathname, '/v26.0/ig_hashtag_search');
  assert.equal(seen[4].url.searchParams.get('q'), 'cltevents');
  assert.equal(seen[4].url.searchParams.get('user_id'), 'ig-42');
  assert.equal(seen[5].url.pathname, '/v26.0/hashtag-9/recent_media');
  assert.equal(seen[5].url.searchParams.get('fields'), 'id,caption,timestamp,permalink,media_type');
  assert.equal(seen[5].url.searchParams.get('limit'), '25');
  assert.equal(seen[6].url.pathname, '/v26.0/debug_token');
  assert.equal(seen[6].url.searchParams.get('input_token'), 'user-token-to-validate');
  assert.equal(seen[6].url.searchParams.get('access_token'), 'test-app|test-secret');
  assert.equal(seen.slice(0, 3).some((row) => row.url.searchParams.has('access_token')), false);
  assert.equal(seen.slice(0, 3).every((row) => row.body.get('access_token') === 'private'), true);
});

test('provider is off by default, template is local, and model budget is checked before fetch', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const draft = await f.drafts.get('feed-01');
  const disabled = new TextProvider({ config: { provider: 'none', providerEnabled: false, providerPeriod: '2026-10', providerBudgetUsd: 0 }, store: f.store });
  await assert.rejects(() => disabled.regenerate(draft, 'Make this clearer.'), { code: 'provider_disabled' });
  const template = new TextProvider({ config: { provider: 'template', providerEnabled: true, providerPeriod: '2026-10', providerBudgetUsd: 0 }, store: f.store, fetchImpl: async () => { throw new Error('must not call a network provider'); } });
  const output = await template.regenerate(draft, 'Offer two practical options.');
  assert.equal(output.estimatedCostUsd, 0);
  assert.match(output.caption, /Offer two practical options/);
  let calls = 0;
  const model = new TextProvider({ config: { provider: 'openai', providerEnabled: true, providerPeriod: '2026-10', providerBudgetUsd: 0.001, providerApiKey: 'test-key', model: 'explicit-test-model', providerMaxOutputTokens: 700, providerInputUsdPerMillion: 10, providerOutputUsdPerMillion: 10 }, store: f.store, fetchImpl: async () => { calls += 1; throw new Error('must be budget-rejected first'); } });
  await assert.rejects(() => model.regenerate(draft, 'Rewrite.'), { code: 'provider_budget_exhausted' });
  assert.equal(calls, 0);
});

test('OAuth uses one-time state and persists discovered tokens only as ciphertext', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const current = parseKey('3'.repeat(64), 'current');
  const vault = new TokenVault({ current });
  const meta = {
    authorizeUrl(state) { return `https://facebook.com/oauth?state=${state}`; },
    async exchangeCode(code) { assert.equal(code, 'single-use-code'); return { access_token: 'short-user-token' }; },
    async exchangeLongLivedUserToken(token) { assert.equal(token, 'short-user-token'); return { access_token: 'long-user-token', expires_in: 3600 }; },
    async listPermissions() { return ['pages_show_list', 'pages_manage_posts']; },
    async listManagedPages() { return [{ id: 'page-42', name: 'Test Page', access_token: 'page-token-secret', tasks: ['CREATE_CONTENT'], instagram_business_account: { id: 'ig-42' } }]; },
  };
  const flow = new OAuthFlow({ config: { oauthReady: true, pkceEnabled: false, redirectUri: 'http://127.0.0.1:4317/oauth/meta/callback', graphVersion: 'v26.0' }, meta, store: f.store, vault });
  const url = new URL(flow.start());
  const accounts = await flow.finish({ state: url.searchParams.get('state'), code: 'single-use-code' });
  assert.equal(accounts.length, 2);
  const state = await f.store.read();
  assert.ok(state.encryptedTokens.ciphertext);
  assert.equal(JSON.stringify(state).includes('long-user-token'), false);
  assert.equal((await flow.tokenBundle()).pages[0].pageAccessToken, 'page-token-secret');
  await assert.rejects(() => flow.finish({ state: url.searchParams.get('state'), code: 'single-use-code' }), { code: 'oauth_state_invalid' });
  await flow.disconnect();
  assert.equal((await f.store.read()).encryptedTokens, null);
});

test('one-shot token import validates app/type/expiry, exchanges token, and saves only the selected Yard Page encrypted', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const current = parseKey('4'.repeat(64), 'current');
  const vault = new TokenVault({ current });
  const now = Date.parse('2026-10-29T12:00:00Z');
  const seen = [];
  const meta = {
    async debugUserAccessToken(token) { seen.push(['debug', token]); return { data: { is_valid: true, app_id: 'yard-app', type: 'USER', expires_at: Math.floor(now / 1000) + 3600 } }; },
    async exchangeLongLivedUserToken(token) { seen.push(['exchange', token]); return { access_token: 'LONG_USER_TOKEN_SECRET', expires_in: 5_000_000 }; },
    async listPermissions(token) { assert.equal(token, 'LONG_USER_TOKEN_SECRET'); return ['pages_show_list', 'instagram_basic']; },
    async listManagedPages(token) { assert.equal(token, 'LONG_USER_TOKEN_SECRET'); return [
      { id: 'unrelated-page', name: 'Other Page', access_token: 'OTHER_PAGE_SECRET', instagram_business_account: { id: 'other-ig' } },
      { id: '1451469751381015', name: 'Yard', access_token: 'YARD_PAGE_SECRET', tasks: ['CREATE_CONTENT'], instagram_business_account: { id: '17841456875103236', account_type: 'BUSINESS' } },
    ]; },
  };
  const flow = new OAuthFlow({ config: { oauthReady: true, appId: 'yard-app' }, meta, store: f.store, vault, now: () => now });
  const accounts = await flow.importUserToken({ userToken: 'SHORT_USER_TOKEN_SECRET', pageId: '1451469751381015' });
  assert.deepEqual(seen, [['debug', 'SHORT_USER_TOKEN_SECRET'], ['exchange', 'SHORT_USER_TOKEN_SECRET'], ['debug', 'LONG_USER_TOKEN_SECRET']]);
  assert.deepEqual(accounts.map((account) => account.id), ['facebook:1451469751381015', 'instagram:17841456875103236']);
  const state = await f.store.read();
  assert.deepEqual(state.accounts.map((account) => account.pageId), ['1451469751381015', '1451469751381015']);
  assert.equal(state.encryptedTokens.ciphertext.includes('LONG_USER_TOKEN_SECRET'), false);
  assert.equal(JSON.stringify(state).includes('YARD_PAGE_SECRET'), false);
  assert.equal(JSON.stringify(state).includes('OTHER_PAGE_SECRET'), false);
  const bundle = vault.decrypt(state.encryptedTokens);
  assert.equal(bundle.userAccessToken, 'LONG_USER_TOKEN_SECRET');
  assert.equal(bundle.pages.length, 1);
  assert.equal(bundle.pages[0].id, '1451469751381015');
  assert.equal(bundle.pages[0].pageAccessToken, 'YARD_PAGE_SECRET');
});

test('one-shot token import rejects wrong app, non-USER type, expired tokens, and non-Yard Page without saving', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const vault = new TokenVault({ current: parseKey('5'.repeat(64), 'current') });
  const now = Date.parse('2026-10-29T12:00:00Z');
  const invalidCases = [
    [{ is_valid: true, app_id: 'other-app', type: 'USER', expires_at: Math.floor(now / 1000) + 300 }, 'user_token_wrong_app'],
    [{ is_valid: true, app_id: 'yard-app', type: 'PAGE', expires_at: Math.floor(now / 1000) + 300 }, 'user_token_wrong_type'],
    [{ is_valid: true, app_id: 'yard-app', type: 'USER', expires_at: Math.floor(now / 1000) - 1 }, 'user_token_expired'],
  ];
  for (const [data, code] of invalidCases) {
    let exchanges = 0;
    const flow = new OAuthFlow({ config: { oauthReady: true, appId: 'yard-app' }, meta: { async debugUserAccessToken() { return { data }; }, async exchangeLongLivedUserToken() { exchanges += 1; return {}; } }, store: f.store, vault, now: () => now });
    await assert.rejects(() => flow.importUserToken({ userToken: 'SHORT_USER_TOKEN_SECRET', pageId: '1451469751381015' }), { code });
    assert.equal(exchanges, 0);
  }
  const pageFlow = new OAuthFlow({ config: { oauthReady: true, appId: 'yard-app' }, meta: {
    async debugUserAccessToken() { return { data: { is_valid: true, app_id: 'yard-app', type: 'USER', expires_at: Math.floor(now / 1000) + 3600 } }; },
    async exchangeLongLivedUserToken() { return { access_token: 'LONG_USER_TOKEN_SECRET' }; },
    async listPermissions() { return []; },
    async listManagedPages() { return [{ id: 'different-page', access_token: 'wrong-page-token', instagram_business_account: { id: 'other-ig' } }]; },
  }, store: f.store, vault, now: () => now });
  await assert.rejects(() => pageFlow.importUserToken({ userToken: 'SHORT_USER_TOKEN_SECRET', pageId: '1451469751381015' }), { code: 'yard_page_not_found' });
  assert.equal((await f.store.read()).encryptedTokens, null);
});

test('refresh uses stored expiry field, updates expiry, and retains the CLI-imported Page allowlist', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const now = Date.parse('2026-10-29T12:00:00Z');
  const vault = new TokenVault({ current: parseKey('6'.repeat(64), 'current') });
  const initial = {
    userAccessToken: 'OLD_USER_TOKEN_SECRET', userTokenExpiresAt: new Date(now + 3600_000).toISOString(),
    permissions: ['instagram_basic'], allowedPageIds: ['1451469751381015'], connectedAt: new Date(now - 1000).toISOString(),
    pages: [{ id: '1451469751381015', name: 'Yard', tasks: ['CREATE_CONTENT'], pageAccessToken: 'OLD_PAGE_TOKEN', instagramUserId: '17841456875103236', instagramAccountType: 'BUSINESS' }],
  };
  await f.store.transaction((state) => { state.encryptedTokens = vault.encrypt(initial); });
  let exchangeCalls = 0;
  const meta = {
    async exchangeLongLivedUserToken(token) { exchangeCalls += 1; assert.equal(token, 'OLD_USER_TOKEN_SECRET'); return { access_token: 'REFRESHED_USER_TOKEN_SECRET', expires_in: 7200 }; },
    async listPermissions() { return ['instagram_basic', 'pages_read_engagement']; },
    async listManagedPages(token) {
      assert.equal(token, 'REFRESHED_USER_TOKEN_SECRET');
      return [
        { id: '1451469751381015', name: 'Yard', access_token: 'REFRESHED_YARD_PAGE_TOKEN', tasks: ['CREATE_CONTENT'], instagram_business_account: { id: '17841456875103236', account_type: 'BUSINESS' } },
        { id: 'unselected-page', name: 'Personal Page', access_token: 'DO_NOT_STORE_THIS', tasks: ['CREATE_CONTENT'], instagram_business_account: { id: 'unrelated-ig' } },
      ];
    },
  };
  const flow = new OAuthFlow({ config: {}, meta, store: f.store, vault, now: () => now });
  const refreshed = await flow.refresh();
  assert.equal(exchangeCalls, 1);
  assert.equal(refreshed.expiresAt, new Date(now + 7200_000).toISOString());
  assert.deepEqual(refreshed.accounts.map((account) => account.pageId), ['1451469751381015', '1451469751381015']);
  const state = await f.store.read();
  const bundle = vault.decrypt(state.encryptedTokens);
  assert.equal(bundle.userTokenExpiresAt, new Date(now + 7200_000).toISOString());
  assert.deepEqual(bundle.allowedPageIds, ['1451469751381015']);
  assert.deepEqual(bundle.pages.map((page) => page.id), ['1451469751381015']);
  assert.equal(JSON.stringify(state).includes('DO_NOT_STORE_THIS'), false);
});

test('refresh rejects missing, invalid, and expired stored expiry without exchange', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const now = Date.parse('2026-10-29T12:00:00Z');
  const vault = new TokenVault({ current: parseKey('7'.repeat(64), 'current') });
  for (const userTokenExpiresAt of [undefined, 'not-a-date', new Date(now - 1).toISOString()]) {
    await f.store.transaction((state) => { state.encryptedTokens = vault.encrypt({ userAccessToken: 'OLD_USER_TOKEN', userTokenExpiresAt, pages: [] }); });
    let calls = 0;
    const flow = new OAuthFlow({ config: {}, meta: { async exchangeLongLivedUserToken() { calls += 1; } }, store: f.store, vault, now: () => now });
    await assert.rejects(() => flow.refresh(), { code: 'reauth_required' });
    assert.equal(calls, 0);
  }
});

test('draft seed exposes hashed JPEGs and disclosed concept storyboard MP4s', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const drafts = await f.drafts.list();
  assert.equal(drafts.filter((item) => item.type === 'feed').length, 9);
  assert.equal(drafts.filter((item) => item.type === 'reel').length, 5);
  const feed = await f.drafts.get('feed-01');
  assert.equal(feed.slides.length, 4);
  assert.match(feed.slides[0].asset.path, /^\/media\/feed-01-01\.jpg$/);
  assert.equal(feed.slides[0].asset.mimeType, 'image/jpeg');
  assert.match(feed.slides[0].asset.sha256, /^[a-f0-9]{64}$/);
  const reel = await f.drafts.get('reel-01');
  assert.equal(reel.mediaPurpose, 'concept_storyboard');
  assert.match(reel.mediaDisclosure, /silent.*no recorded footage/i);
  assert.equal(reel.assets[0].mimeType, 'video/mp4');
  assert.equal(reel.mediaReady, true);
  assert.equal((await f.drafts.calendar()).length, 30);
});

test('editing creates a new revision, rejects stale writes, and invalidates approval', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const current = await f.drafts.get('feed-02');
  await f.store.transaction((state) => { state.approvals.push({ id: 'approval-old', draftId: current.id, status: 'approved' }); });
  const updated = await f.drafts.update(current.id, { expectedRevision: current.revision, expectedContentSha256: current.contentSha256, title: `${current.title} · edit` });
  assert.equal(updated.revision, current.revision + 1);
  assert.notEqual(updated.contentSha256, current.contentSha256);
  assert.equal((await f.store.read()).approvals[0].status, 'invalidated');
  await assert.rejects(() => f.drafts.update(current.id, { expectedRevision: current.revision, expectedContentSha256: current.contentSha256, caption: 'stale' }), { code: 'revision_conflict' });
  await assert.rejects(() => f.drafts.update(current.id, { expectedRevision: updated.revision, expectedContentSha256: updated.contentSha256, slides: [] }), { code: 'invalid_request' });
  const reel = await f.drafts.get('reel-01');
  await assert.rejects(() => f.drafts.update(reel.id, { expectedRevision: reel.revision, expectedContentSha256: reel.contentSha256, timestampedScript: [{ ...reel.timestampedScript[0], onScreen: 'Changed text' }] }), { code: 'media_sync_required' });
  await assert.rejects(() => f.drafts.update(reel.id, { expectedRevision: reel.revision, expectedContentSha256: reel.contentSha256, shotList: [{ ...reel.shotList[0], shot: 'Changed shot' }] }), { code: 'media_sync_required' });
  assert.equal((await f.drafts.get(reel.id)).contentSha256, reel.contentSha256);
});

test('approval binds account/action/time and disabled publishing makes no Meta write', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  let writes = 0;
  const meta = { async publishFacebookFeed() { writes += 1; return { id: 'post-id' }; } };
  const service = new ApprovalService({ config: { publishingEnabled: false }, store: f.store, drafts: f.drafts, oauth, meta });
  const draft = await f.drafts.get('feed-01');
  const approval = await service.create({ draftId: draft.id, revision: draft.revision, contentSha256: draft.contentSha256, target: { platform: 'facebook', accountId: 'facebook:page-42' }, action: 'publish_now', scheduledAt: null, approver: 'Test Reviewer' });
  assert.equal(approval.status, 'approved');
  assert.equal(approval.target.accountId, 'facebook:page-42');
  assert.equal(approval.action, 'publish_now');
  assert.equal(approval.scheduledAt, null);
  assert.equal(approval.assetHashes.length, draft.slides.length);
  assert.deepEqual(approval.contentSnapshot.slides[0], { headline: draft.slides[0].headline, body: draft.slides[0].body });
  assert.equal(approval.contentSnapshot.assets[0].sha256, draft.assets[0].sha256);
  await assert.rejects(() => service.execute(approval.id), { code: 'publishing_disabled' });
  assert.equal(writes, 0);
  const schedule = await service.create({ draftId: draft.id, revision: draft.revision, contentSha256: draft.contentSha256, target: { platform: 'facebook', accountId: 'facebook:page-42' }, action: 'schedule', scheduledAt: new Date(Date.now() + 60_000).toISOString(), approver: 'Test Reviewer' });
  assert.equal(schedule.action, 'schedule');
});

test('Instagram caption length and future schedule execution fail closed', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  const draft = await f.drafts.get('feed-03');
  const longDraft = await f.drafts.update(draft.id, { expectedRevision: draft.revision, expectedContentSha256: draft.contentSha256, caption: 'x'.repeat(2300) });
  let writes = 0;
  const meta = { async publishInstagramContainer() { writes += 1; return { id: 'published' }; } };
  const service = new ApprovalService({ config: { publishingEnabled: true, mediaBaseUrl: 'https://8.8.8.8/media' }, store: f.store, drafts: f.drafts, oauth, meta });
  await assert.rejects(() => service.create({ draftId: longDraft.id, revision: longDraft.revision, contentSha256: longDraft.contentSha256, target: { platform: 'instagram', accountId: 'instagram:ig-42' }, action: 'publish_now', scheduledAt: null, approver: 'Test Reviewer' }), { code: 'caption_too_long' });
  const valid = await f.drafts.get('feed-04');
  const approval = await service.create({ draftId: valid.id, revision: valid.revision, contentSha256: valid.contentSha256, target: { platform: 'instagram', accountId: 'instagram:ig-42' }, action: 'schedule', scheduledAt: new Date(Date.now() + 60_000).toISOString(), approver: 'Test Reviewer' });
  await assert.rejects(() => service.execute(approval.id), { code: 'scheduled_not_due' });
  assert.equal(writes, 0);
});

test('ambiguous publish results lock exact action from blind retry', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  const publicFiles = new Map();
  const draft = await f.drafts.get('feed-01');
  for (const asset of draft.assets) publicFiles.set(asset.name, await readFile(resolve(root, 'marketing/preview/media/jpeg', asset.name)));
  const calls = [];
  const fetchImpl = async (url) => {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
    const bytes = publicFiles.get(name);
    return new Response(bytes, { status: bytes ? 200 : 404 });
  };
  const meta = {
    async uploadFacebookPhoto() { return { id: `photo-${calls.length + 1}` }; },
    async publishFacebookFeed() { calls.push('feed-publish'); throw new MetaApiError({ status: 502, code: 'meta_timeout', retryable: true }); },
  };
  const service = new ApprovalService({ config: { publishingEnabled: true, mediaBaseUrl: 'https://8.8.8.8/media' }, store: f.store, drafts: f.drafts, oauth, meta, fetchImpl });
  const approval = await service.create({ draftId: draft.id, revision: draft.revision, contentSha256: draft.contentSha256, target: { platform: 'facebook', accountId: 'facebook:page-42' }, action: 'publish_now', scheduledAt: null, approver: 'Test Reviewer' });
  await assert.rejects(() => service.execute(approval.id), { code: 'meta_timeout' });
  const state = await f.store.read();
  assert.equal(state.approvals[0].status, 'outcome_unknown');
  assert.equal(state.attempts[0].status, 'outcome_unknown');
  assert.equal(state.attempts[0].remoteIds.length, 4);
  assert.deepEqual(calls, ['feed-publish']);
  await assert.rejects(() => service.execute(approval.id), { code: 'outcome_unknown' });
  assert.deepEqual(calls, ['feed-publish']);
});

test('revoke winning the transaction race prevents the pending execution from starting', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  const meta = { async publishFacebookFeed() { assert.fail('A revoked approval must never reach Meta.'); } };
  const creator = new ApprovalService({ config: { publishingEnabled: true }, store: f.store, drafts: f.drafts, oauth, meta });
  const draft = await f.drafts.get('feed-05');
  const approval = await creator.create({ draftId: draft.id, revision: draft.revision, contentSha256: draft.contentSha256, target: { platform: 'facebook', accountId: 'facebook:page-42' }, action: 'publish_now', scheduledAt: null, approver: 'Test Reviewer' });

  let entered; const enteredPromise = new Promise((resolveEntered) => { entered = resolveEntered; });
  let release; const releasePromise = new Promise((resolveRelease) => { release = resolveRelease; });
  let pause = true;
  const gatedDrafts = {
    async get(id) { if (pause) { pause = false; entered(); await releasePromise; } return f.drafts.get(id); },
    assetsFor: (id) => f.drafts.assetsFor(id),
  };
  const executor = new ApprovalService({ config: { publishingEnabled: true }, store: f.store, drafts: gatedDrafts, oauth, meta });
  const pendingExecution = executor.execute(approval.id);
  await enteredPromise;
  await creator.revoke(approval.id, 'Stop before execution.');
  release();
  await assert.rejects(() => pendingExecution, { code: 'approval_not_active' });
  const state = await f.store.read();
  assert.equal(state.approvals[0].status, 'revoked');
  assert.equal(state.attempts.length, 0);
});

test('execution claim makes revoke fail while a publish is in flight', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  const draft = await f.drafts.get('feed-06');
  const files = new Map();
  for (const asset of draft.assets) files.set(asset.name, await readFile(resolve(root, 'marketing/preview/media/jpeg', asset.name)));
  let startedFetch; const fetchStarted = new Promise((resolveFetch) => { startedFetch = resolveFetch; });
  let releaseFetch; const release = new Promise((resolveFetch) => { releaseFetch = resolveFetch; });
  let first = true;
  const fetchImpl = async (url) => {
    if (first) { first = false; startedFetch(); await release; }
    const bytes = files.get(decodeURIComponent(new URL(url).pathname.split('/').pop()));
    return new Response(bytes, { status: bytes ? 200 : 404 });
  };
  let photoId = 0;
  const meta = {
    async uploadFacebookPhoto() { photoId += 1; return { id: `photo-${photoId}` }; },
    async publishFacebookFeed() { return { id: 'post-complete' }; },
  };
  const service = new ApprovalService({ config: { publishingEnabled: true, mediaBaseUrl: 'https://8.8.8.8/media' }, store: f.store, drafts: f.drafts, oauth, meta, fetchImpl });
  const approval = await service.create({ draftId: draft.id, revision: draft.revision, contentSha256: draft.contentSha256, target: { platform: 'facebook', accountId: 'facebook:page-42' }, action: 'publish_now', scheduledAt: null, approver: 'Test Reviewer' });
  const pendingExecution = service.execute(approval.id);
  await fetchStarted;
  await assert.rejects(() => service.revoke(approval.id, 'Too late.'), { code: 'approval_not_revokeable' });
  releaseFetch();
  const result = await pendingExecution;
  assert.equal(result.attempt.status, 'complete');
  assert.equal((await f.store.read()).approvals[0].status, 'published');
});

test('startup recovery turns interrupted preparing attempts into locked unknown outcomes', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await f.store.transaction((state) => {
    state.approvals.push({ id: 'approval-crashed', draftId: 'feed-07', status: 'executing', action: 'publish_now' });
    state.attempts.push({ id: 'attempt-crashed', approvalId: 'approval-crashed', status: 'preparing', remoteIds: [] });
  });
  const service = new ApprovalService({ config: { publishingEnabled: false }, store: f.store, drafts: f.drafts, oauth, meta: {} });
  assert.deepEqual(await service.recoverInFlight(), ['attempt-crashed']);
  const state = await f.store.read();
  assert.equal(state.attempts[0].status, 'outcome_unknown');
  assert.equal(state.approvals[0].status, 'outcome_unknown');
  await service.resolveUnknown('attempt-crashed', { resolution: 'confirmed_not_published', reviewer: 'Reviewer', note: 'Checked the Page.' });
  const resolved = await f.store.read();
  assert.equal(resolved.attempts[0].status, 'resolved_not_published');
  assert.equal(resolved.approvals[0].status, 'resolved_not_published');
});

test('Business Discovery uses only the user token, stores a first-page source snapshot, and deduplicates', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  let usedToken = '';
  let rows = [
    { id: 'post-1', caption: 'A coffee pop-up this Saturday.', permalink: 'https://www.instagram.com/p/post1/', timestamp: '2026-10-28T15:00:00+00:00', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/image.jpg' },
    { id: 'post-2', caption: 'New menu.', permalink: 'https://www.instagram.com/p/post2/', timestamp: '2026-10-27T14:00:00Z', media_type: 'CAROUSEL_ALBUM' },
    { id: 'bad-post', caption: 'Ignore invalid source link.', permalink: 'http://example.com/post', timestamp: 'not-a-date', media_type: 'IMAGE' },
  ];
  const discoveryOauth = { async tokenBundle() { return { userAccessToken: 'user-token-secret', permissions: ['instagram_basic', 'instagram_manage_insights', 'pages_read_engagement'], pages: [{ id: 'page-42', instagramUserId: 'ig-42' }] }; } };
  const meta = { async getInstagramBusinessDiscovery({ instagramUserId, userToken, username }) { assert.equal(instagramUserId, 'ig-42'); assert.equal(username, 'charlottecoffee'); usedToken = userToken; return { business_discovery: { username, media: { data: rows } } }; } };
  const service = new DiscoveryService({ store: f.store, oauth: discoveryOauth, meta, now: () => Date.parse('2026-10-29T12:00:00Z') });
  const first = await service.collect({ accountId: 'instagram:ig-42', username: 'charlottecoffee' });
  assert.equal(usedToken, 'user-token-secret');
  assert.deepEqual(first.collection, { id: first.collection.id, accountId: 'instagram:ig-42', username: 'charlottecoffee', fetchedAt: '2026-10-29T12:00:00.000Z', returnedCount: 3, newCandidateCount: 2, duplicateCount: 0, invalidCount: 1, limit: 25, moreResultsMayExist: true });
  const candidate = first.candidates[0];
  assert.equal(candidate.sourcePlatform, 'instagram');
  assert.equal(candidate.sourcePostId, 'post-1');
  assert.equal(candidate.sourceUsername, 'charlottecoffee');
  assert.equal(candidate.mediaUrl, 'https://scontent.cdninstagram.com/image.jpg');
  assert.equal(candidate.reviewStatus, 'unreviewed');
  assert.equal('eventDate' in candidate, false);
  assert.equal(candidate.postedAt, '2026-10-28T15:00:00.000Z');
  const state = await f.store.read();
  assert.equal(state.activity.filter((item) => item.type === 'yard_event_created').length, 0);
  assert.equal(state.activity[0].collectionId, first.collection.id);
  assert.equal(state.discoveryCandidates.length, 2);
  rows = [rows[0]];
  const second = await service.collect({ accountId: 'instagram:ig-42', username: 'charlottecoffee' });
  assert.equal(second.collection.duplicateCount, 1);
  assert.equal(second.collection.newCandidateCount, 0);
  assert.equal((await service.listCandidates()).length, 2);
  assert.equal((await service.listCandidates()).find((item) => item.sourcePostId === 'post-1').collectionCount, 2);
});

test('Business Discovery blocks unknown accounts, invalid handles, and missing permissions before Graph calls', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  let calls = 0;
  const service = new DiscoveryService({ store: f.store, oauth: { async tokenBundle() { return { userAccessToken: 'secret', permissions: ['instagram_basic', 'pages_read_engagement'], pages: [{ id: 'page-42', instagramUserId: 'ig-42' }] }; } }, meta: { async getInstagramBusinessDiscovery() { calls += 1; return {}; } } });
  await assert.rejects(() => service.collect({ accountId: 'instagram:unknown', username: 'source' }), { code: 'account_not_connected' });
  await assert.rejects(() => service.collect({ accountId: 'instagram:ig-42', username: '@source' }), { code: 'invalid_request' });
  await assert.rejects(() => service.collect({ accountId: 'instagram:ig-42', username: 'source' }), { code: 'permission_missing' });
  assert.equal(calls, 0);
});

test('following export import accepts bounded Instagram relationships, deduplicates, and stores unverified leads only', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  const service = new DiscoveryService({ store: f.store, oauth, meta: {}, now: () => Date.parse('2026-10-29T12:00:00Z') });
  const imported = await service.importFollowing({ relationships_following: [
    { title: 'CharlotteCoffee', string_list_data: [{ value: 'CharlotteCoffee', timestamp: 1793293200 }] },
    { title: 'duplicate', string_list_data: [{ value: '@charlottecoffee' }] },
    { title: 'broken', string_list_data: [{ value: 'not a username' }] },
    { title: 'empty', string_list_data: [] },
  ] });
  assert.equal(imported.total, 4);
  assert.equal(imported.unique, 1);
  assert.equal(imported.imported, 1);
  assert.equal(imported.invalid, 2);
  assert.equal(imported.leads[0].status, 'unverified');
  assert.equal(imported.leads[0].qualification, 'unverified_personal_following_is_not_location_or_business_evidence');
  assert.equal((await service.importFollowing({ relationships_following: [{ string_list_data: [{ value: 'CHARLOTTECOFFEE' }] }] })).duplicates, 1);
  await assert.rejects(() => service.importFollowing({ relationships_following: 'bad' }), { code: 'invalid_following_export' });
  await assert.rejects(() => service.importFollowing({ relationships_following: Array(20_001).fill({ string_list_data: [] }) }), { code: 'invalid_following_export' });
  const state = await f.store.read();
  assert.equal(state.discoveryLeads.length, 1);
  assert.equal(state.discoveryCandidates.length, 0);
  assert.equal(state.activity.some((item) => item.type === 'yard_event_created'), false);
});

test('hashtag collector derives connected IG ID, uses USER token, dedupes attribution, and never creates Yard events', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  await f.store.transaction((state) => state.discoveryCandidates.push({
    id: 'candidate-existing', sourcePlatform: 'instagram', sourcePostId: 'post-shared', sourceUsername: 'charlottevenue',
    sourceAttributions: [{ type: 'business_discovery', value: 'charlottevenue' }], collectionCount: 1, reviewStatus: 'unreviewed',
  }));
  const used = [];
  const discoveryOauth = { async tokenBundle() { return { userAccessToken: 'private-user-token', permissions: ['instagram_basic', 'pages_read_engagement'], pages: [{ id: 'page-42', instagramUserId: 'ig-42' }] }; } };
  const meta = {
    async searchInstagramHashtag(args) { used.push({ method: 'search', ...args }); return { data: [{ id: 'hashtag-id' }] }; },
    async getInstagramHashtagRecentMedia(args) { used.push({ method: 'recent', ...args }); return { data: [
      { id: 'post-shared', permalink: 'https://www.instagram.com/p/shared/', timestamp: '2026-10-28T12:00:00Z', media_type: 'IMAGE', caption: 'Event Saturday' },
      { id: 'post-new', permalink: 'https://www.instagram.com/p/new/', timestamp: Date.parse('2026-10-27T12:00:00Z') / 1000, media_type: 'VIDEO', caption: 'Another event' },
    ] }; },
  };
  const service = new DiscoveryService({ store: f.store, oauth: discoveryOauth, meta, now: () => Date.parse('2026-10-29T12:00:00Z') });
  const result = await service.collectHashtag({ accountId: 'instagram:ig-42', hashtag: '#cltevents' });
  assert.equal(used.length, 2);
  assert.equal(used.every((item) => item.instagramUserId === 'ig-42' && item.userToken === 'private-user-token'), true);
  assert.equal(used.some((item) => item.instagramUserId === '17841456875103236'), false);
  assert.equal(result.collection.returnedCount, 2);
  assert.equal(result.collection.duplicateCount, 1);
  const state = await f.store.read();
  const shared = state.discoveryCandidates.find((row) => row.sourcePostId === 'post-shared');
  assert.equal(shared.sourceUsername, 'charlottevenue');
  assert.deepEqual(shared.sourceAttributions, [{ type: 'business_discovery', value: 'charlottevenue' }, { type: 'hashtag', value: 'cltevents' }]);
  const newCandidate = state.discoveryCandidates.find((row) => row.sourcePostId === 'post-new');
  assert.equal(newCandidate.sourceUsername, null);
  assert.equal(newCandidate.sourceHashtag, 'cltevents');
  assert.equal(newCandidate.postedAt, '2026-10-27T12:00:00.000Z');
  assert.equal('eventDate' in newCandidate, false);
  assert.equal(state.activity.some((item) => item.type === 'yard_event_created'), false);
  assert.equal((await service.hashtagQuota()).used, 1);
});

test('hashtag collector fails before Graph on missing permissions, records Graph failure without classifying account', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  let calls = 0;
  const service = new DiscoveryService({ store: f.store, oauth: { async tokenBundle() { return { userAccessToken: 'secret', permissions: ['instagram_basic'], pages: [{ id: 'page-42', instagramUserId: 'ig-42' }] }; } }, meta: { async searchInstagramHashtag() { calls += 1; } } });
  await assert.rejects(() => service.collectHashtag({ accountId: 'instagram:ig-42', hashtag: 'clt events' }), { code: 'invalid_request' });
  await assert.rejects(() => service.collectHashtag({ accountId: 'instagram:ig-42', hashtag: 'cltevents' }), { code: 'permission_missing' });
  assert.equal(calls, 0);
  const authorized = new DiscoveryService({ store: f.store, oauth: { async tokenBundle() { return { userAccessToken: 'secret', permissions: ['instagram_basic', 'pages_read_engagement'], pages: [{ id: 'page-42', instagramUserId: 'ig-42' }] }; } }, meta: { async searchInstagramHashtag() { throw new MetaApiError({ status: 400, code: 'meta_10' }); } } });
  await assert.rejects(() => authorized.collectHashtag({ accountId: 'instagram:ig-42', hashtag: 'cltevents' }), { code: 'meta_10' });
  const state = await f.store.read();
  assert.equal(state.hashtagSearchAttempts[0].status, 'failed');
  assert.equal(state.hashtagSearchAttempts[0].code, 'meta_10');
  assert.equal('accountType' in state, false);
  assert.equal(state.discoveryCandidates.length, 0);
});

test('hashtag rolling window counts conservative unique attempts and enforces 30 distinct searches', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await connectedState(f.store);
  const now = Date.parse('2026-10-29T12:00:00Z');
  await f.store.transaction((state) => { state.hashtagSearchAttempts = Array.from({ length: 30 }, (_, i) => ({ id: `attempt-${i}`, hashtag: `tag_${i}`, at: new Date(now - i * 1000).toISOString(), status: 'failed' })); });
  let calls = 0;
  const service = new DiscoveryService({ store: f.store, oauth: { async tokenBundle() { return { userAccessToken: 'secret', permissions: ['instagram_basic', 'pages_read_engagement'], pages: [{ id: 'page-42', instagramUserId: 'ig-42' }] }; } }, meta: { async searchInstagramHashtag() { calls += 1; return { data: [] }; } }, now: () => now });
  await assert.rejects(() => service.collectHashtag({ accountId: 'instagram:ig-42', hashtag: 'new_tag' }), { code: 'hashtag_quota_exhausted' });
  assert.equal(calls, 0);
  assert.equal((await service.hashtagQuota()).used, 30);
});

test('event review creates separate blank drafts with immutable Instagram provenance', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await addEventCandidate(f.store);
  const service = new EventReviewService({ store: f.store, now: () => Date.parse('2026-10-29T12:00:00Z') });
  const first = await service.create({ candidateId: 'candidate-event-1' });
  const second = await service.create({ candidateId: 'candidate-event-1' });
  assert.notEqual(first.id, second.id);
  assert.equal(first.candidateId, 'candidate-event-1');
  assert.equal(first.status, 'draft');
  assert.equal(first.revision, 1);
  assert.equal(first.title, '');
  assert.equal(first.details, '');
  assert.equal(first.starts_at, '');
  assert.equal(first.source_handle, 'instagram:campnorthend');
  assert.equal(first.link, 'https://www.instagram.com/p/DfDVAQII9K7/');
  assert.equal(first.source.caption, 'Source copy must not become event copy.');
  assert.equal(first.source.sourcePermalink, 'https://www.instagram.com/p/DfDVAQII9K7/');
  assert.equal((await service.status()).liveWrites, false);
  await assert.rejects(() => service.create({ candidateId: 'missing-candidate' }), { code: 'candidate_not_found' });
});

test('event export skips incomplete drafts and rejects invalid calendar, offset, time range, and overlength values', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await addEventCandidate(f.store);
  const service = new EventReviewService({ store: f.store, now: () => Date.parse('2026-10-29T12:00:00Z') });
  assert.equal(typeof service.approve, 'undefined');
  let draft = await service.create({ candidateId: 'candidate-event-1' });
  assert.deepEqual(await service.export(), { events: [] });
  draft = await completeEventDraft(service, draft, { starts_at: '2026-02-30T12:00:00-05:00' });
  assert.deepEqual(await validateEventReviewDraft(service, draft), { events: [] });
  draft = await completeEventDraft(service, draft, { starts_at: '2026-11-01T12:00:00-04:00' });
  assert.deepEqual(await validateEventReviewDraft(service, draft), { events: [] });
  draft = await completeEventDraft(service, draft, { starts_at: '2026-11-01T12:00:00-05:00', ends_at: '2026-11-01T11:00:00-05:00' });
  assert.deepEqual(await validateEventReviewDraft(service, draft), { events: [] });
  draft = await completeEventDraft(service, draft, { starts_at: '2026-12-15T12:00:00-05:00', ends_at: '' });
  assert.deepEqual(await validateEventReviewDraft(service, draft), { events: [] });
  await assert.rejects(() => service.update(draft.id, { expectedRevision: draft.revision, title: 'x'.repeat(121) }), { code: 'invalid_event_draft' });
});

async function validateEventReviewDraft(service, draft) {
  assert.ok(draft.revision >= 1);
  return service.export();
}

test('event export contains only inbox schema fields, deduplicates reruns, and preserves offset; no approval or live write', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await addEventCandidate(f.store);
  const service = new EventReviewService({ store: f.store, now: () => Date.parse('2026-10-29T12:00:00Z') });
  let draft = await service.create({ candidateId: 'candidate-event-1' });
  draft = await completeEventDraft(service, draft);
  const twin = await service.create({ candidateId: 'candidate-event-1' });
  await completeEventDraft(service, twin);
  const result = await service.export();
  const repeated = await service.export();
  assert.deepEqual(result, repeated);
  assert.equal(result.events.length, 1);
  assert.deepEqual(Object.keys(result.events[0]).sort(), ['address', 'details', 'ends_at', 'link', 'source_handle', 'starts_at', 'title', 'venue'].sort());
  assert.equal(result.events[0].starts_at, '2026-11-01T12:00:00-05:00');
  assert.equal(result.events[0].ends_at, '2026-11-01T18:00:00-05:00');
  assert.equal(result.events[0].title, "Festival Día de Muertos: O'Fallon's Night");
  assert.equal(result.events[0].link, 'https://www.instagram.com/p/DfDVAQII9K7/');
  assert.equal(result.events[0].source_handle, 'instagram:campnorthend');
  assert.equal(result.events[0].details, 'A family-friendly afternoon at Camp North End with music and activities.');
  assert.equal('evidenceNotes' in result.events[0], false);
  assert.equal('status' in result.events[0], false);
  assert.equal('lat' in result.events[0], false);
  assert.equal('isFree' in result.events[0], false);
  assert.equal((await service.status()).liveWrites, false);
  await assert.rejects(() => service.update(draft.id, { expectedRevision: draft.revision - 1, title: 'stale' }), { code: 'revision_conflict' });
  const edited = await service.update(draft.id, { expectedRevision: draft.revision, details: 'A freshly rewritten event detail.' });
  assert.equal(edited.status, 'draft');
  assert.equal(edited.revision, draft.revision + 1);
  assert.equal((await service.export()).events[0].details, 'A freshly rewritten event detail.');
  const state = await f.store.read();
  assert.equal(state.activity.some((item) => item.type === 'yard_event_created'), false);
});

test('event rejection excludes a draft from export and owner inbox keys cannot be overridden', async (t) => {
  const f = await fixture(); t.after(() => rm(f.directory, { recursive: true, force: true }));
  await addEventCandidate(f.store);
  const service = new EventReviewService({ store: f.store, now: () => Date.parse('2026-10-29T12:00:00Z') });
  let draft = await service.create({ candidateId: 'candidate-event-1' });
  draft = await completeEventDraft(service, draft);
  draft = await service.reject(draft.id, { expectedRevision: draft.revision, reason: 'Date needs primary-source confirmation.' });
  assert.equal(draft.status, 'rejected');
  assert.deepEqual(await service.export(), { events: [] });
  await assert.rejects(() => service.update(draft.id, { expectedRevision: draft.revision, link: 'https://attacker.example/' }), { code: 'invalid_request' });
  const revised = await service.update(draft.id, { expectedRevision: draft.revision, evidenceNotes: 'Organizer page checked.' });
  assert.equal(revised.status, 'draft');
  assert.equal(revised.revision, draft.revision + 1);
});
