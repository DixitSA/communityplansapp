import { randomUUID } from 'node:crypto';
import { AppError } from './errors.mjs';

const REQUIRED_PERMISSIONS = ['instagram_basic', 'instagram_manage_insights', 'pages_read_engagement'];
const HASHTAG_PERMISSIONS = ['instagram_basic', 'pages_read_engagement'];
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
const HASHTAG_RE = /^[A-Za-z0-9_]{1,30}$/;
const CAPTION_LIMIT = 4000;
const HASHTAG_LIMIT = 30;
const HASHTAG_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function safeInstagramPermalink(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch { return null; }
}

function safeMetaMediaUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !(host.endsWith('.cdninstagram.com') || host.endsWith('.fbcdn.net'))) return null;
    return url.toString();
  } catch { return null; }
}

function sourcePost(item, requestedUsername, accountId, at, sourceAttribution) {
  if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(item.id)) return null;
  const permalink = safeInstagramPermalink(item.permalink);
  if (!permalink) return null;
  const returnedUsername = typeof item.username === 'string' && USERNAME_RE.test(item.username) ? item.username : requestedUsername;
  const rawCaption = typeof item.caption === 'string' ? item.caption : '';
  let postedAt = null;
  if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) {
    const date = new Date(item.timestamp * 1000);
    if (Number.isFinite(date.getTime())) postedAt = date.toISOString();
  } else if (typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp))) {
    postedAt = new Date(item.timestamp).toISOString();
  }
  const mediaType = typeof item.media_type === 'string' && /^[A-Z_]{1,40}$/.test(item.media_type) ? item.media_type : 'UNKNOWN';
  const attribution = sourceAttribution || (returnedUsername ? { type: 'business_discovery', value: returnedUsername.toLowerCase() } : null);
  return {
    id: randomUUID(),
    sourcePlatform: 'instagram',
    sourcePostId: item.id,
    sourceUsername: returnedUsername,
    sourcePermalink: permalink,
    mediaUrl: safeMetaMediaUrl(item.media_url),
    caption: rawCaption.slice(0, CAPTION_LIMIT),
    captionTruncated: rawCaption.length > CAPTION_LIMIT,
    postedAt,
    mediaType,
    accountId,
    sourceHashtag: attribution?.type === 'hashtag' ? attribution.value : null,
    sourceAttributions: attribution ? [attribution] : [],
    firstSeenAt: at,
    lastSeenAt: at,
    collectionCount: 1,
    reviewStatus: 'unreviewed',
  };
}

export class DiscoveryService {
  constructor({ store, oauth, meta, now = () => Date.now() }) {
    Object.assign(this, { store, oauth, meta, now });
  }

  async readiness() {
    const state = await this.store.read();
    const linked = state.accounts.filter((account) => account.connected && account.platform === 'instagram' && account.instagramUserId);
    let grantedPermissions = [];
    let userTokenAvailable = false;
    if (state.encryptedTokens) {
      try {
        const bundle = await this.oauth.tokenBundle();
        grantedPermissions = bundle.permissions || [];
        userTokenAvailable = typeof bundle.userAccessToken === 'string' && bundle.userAccessToken.length > 0 && (!bundle.userTokenExpiresAt || Date.parse(bundle.userTokenExpiresAt) > this.now());
      }
      catch { grantedPermissions = []; }
    }
    const missingPermissions = REQUIRED_PERMISSIONS.filter((permission) => !grantedPermissions.includes(permission));
    return {
      ready: linked.length > 0 && missingPermissions.length === 0 && userTokenAvailable,
      requiredPermissions: [...REQUIRED_PERMISSIONS],
      grantedPermissions: REQUIRED_PERMISSIONS.filter((permission) => grantedPermissions.includes(permission)),
      missingPermissions,
      connectedInstagramAccounts: linked.length,
      userTokenAvailable,
    };
  }

  async hashtagReadiness() {
    const state = await this.store.read();
    const linked = state.accounts.filter((account) => account.connected && account.platform === 'instagram' && account.instagramUserId);
    let grantedPermissions = [];
    let userTokenAvailable = false;
    if (state.encryptedTokens) {
      try {
        const bundle = await this.oauth.tokenBundle();
        grantedPermissions = bundle.permissions || [];
        userTokenAvailable = typeof bundle.userAccessToken === 'string' && bundle.userAccessToken.length > 0 && (!bundle.userTokenExpiresAt || Date.parse(bundle.userTokenExpiresAt) > this.now());
      } catch { grantedPermissions = []; }
    }
    const missingPermissions = HASHTAG_PERMISSIONS.filter((permission) => !grantedPermissions.includes(permission));
    return {
      ready: linked.length > 0 && missingPermissions.length === 0 && userTokenAvailable,
      requiredPermissions: [...HASHTAG_PERMISSIONS],
      grantedPermissions: HASHTAG_PERMISSIONS.filter((permission) => grantedPermissions.includes(permission)),
      missingPermissions,
      connectedInstagramAccounts: linked.length,
      userTokenAvailable,
      publicContentAccessRequired: true,
    };
  }

  async importFollowing(input) {
    const rows = input?.relationships_following;
    if (!Array.isArray(rows) || rows.length > 20_000) throw new AppError('invalid_following_export', 'Expected a valid Instagram relationships_following export with no more than 20,000 entries.');
    const at = new Date(this.now()).toISOString();
    const found = new Map();
    let invalidCount = 0;
    for (const row of rows) {
      const entries = Array.isArray(row?.string_list_data) ? row.string_list_data : [];
      if (!entries.length) { invalidCount += 1; continue; }
      let valid = false;
      for (const item of entries) {
        const username = typeof item?.value === 'string' ? item.value.trim().replace(/^@/, '') : '';
        if (!USERNAME_RE.test(username)) { invalidCount += 1; continue; }
        valid = true;
        const key = username.toLowerCase();
        let followedAt = null;
        if (Number.isFinite(Number(item.timestamp))) {
          const date = new Date(Number(item.timestamp) * 1000);
          if (Number.isFinite(date.getTime())) followedAt = date.toISOString();
        }
        if (!found.has(key)) found.set(key, { username, followedAt });
      }
      if (!valid) continue;
    }
    let importedCount = 0;
    let duplicateCount = 0;
    const leads = [];
    await this.store.transaction((db) => {
      db.discoveryLeads ||= [];
      for (const item of found.values()) {
        const existing = db.discoveryLeads.find((lead) => lead.username.toLowerCase() === item.username.toLowerCase());
        if (existing) { duplicateCount += 1; leads.push(existing); continue; }
        const lead = {
          id: randomUUID(), username: item.username, status: 'unverified', source: 'instagram_following_export',
          followedAt: item.followedAt, firstSeenAt: at,
          qualification: 'unverified_personal_following_is_not_location_or_business_evidence',
        };
        db.discoveryLeads.unshift(lead);
        leads.push(lead);
        importedCount += 1;
      }
      db.activity.unshift({ id: randomUUID(), type: 'instagram_following_imported', at, entryCount: rows.length, uniqueUsernameCount: found.size, importedCount, duplicateCount, invalidCount });
    });
    return { total: rows.length, unique: found.size, imported: importedCount, duplicates: duplicateCount, invalid: invalidCount, leads };
  }

  async listLeads() {
    const state = await this.store.read();
    return [...(state.discoveryLeads || [])].sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt));
  }

  async hashtagQuota() {
    const state = await this.store.read();
    const cutoff = this.now() - HASHTAG_WINDOW_MS;
    const attempts = (state.hashtagSearchAttempts || []).filter((item) => Date.parse(item.at) >= cutoff);
    const unique = new Set(attempts.map((item) => item.hashtag.toLowerCase()));
    return {
      used: unique.size, limit: HASHTAG_LIMIT, windowDays: 7, remaining: Math.max(0, HASHTAG_LIMIT - unique.size),
      attempts: attempts.map(({ id, hashtag, at, status, code }) => ({ id, hashtag, at, status, ...(code ? { code } : {}) })),
    };
  }

  async collectHashtag(input) {
    if (!input || typeof input.accountId !== 'string' || input.accountId.length > 180) throw new AppError('invalid_request', 'Select a connected Instagram account.');
    if (typeof input.hashtag !== 'string') throw new AppError('invalid_request', 'Enter one hashtag without #.');
    const hashtag = input.hashtag.trim().replace(/^#/, '');
    if (!HASHTAG_RE.test(hashtag)) throw new AppError('invalid_request', 'Enter one valid hashtag without spaces or punctuation.');
    const state = await this.store.read();
    const account = state.accounts.find((row) => row.id === input.accountId && row.platform === 'instagram' && row.connected && row.instagramUserId);
    if (!account) throw new AppError('account_not_connected', 'Choose a connected Instagram professional account.', 401);
    const bundle = await this.oauth.tokenBundle();
    const missing = HASHTAG_PERMISSIONS.filter((permission) => !bundle.permissions?.includes(permission));
    if (missing.length) throw new AppError('permission_missing', `Meta permission ${missing[0]} is not granted.`, 403);
    if (typeof bundle.userAccessToken !== 'string' || !bundle.userAccessToken) throw new AppError('account_not_connected', 'The encrypted Facebook user token is unavailable.', 401);
    if (bundle.userTokenExpiresAt && (!Number.isFinite(Date.parse(bundle.userTokenExpiresAt)) || Date.parse(bundle.userTokenExpiresAt) <= this.now())) throw new AppError('reauth_required', 'The Facebook user token has expired or has an invalid expiry. Reconnect Meta before collecting hashtags.', 401);
    const linkedPage = bundle.pages?.find((page) => page.id === account.pageId && page.instagramUserId === account.instagramUserId);
    if (!linkedPage) throw new AppError('account_not_connected', 'The selected Instagram account is no longer linked to its Page.', 409);

    const at = new Date(this.now()).toISOString();
    const attemptId = randomUUID();
    await this.store.transaction((db) => {
      db.hashtagSearchAttempts ||= [];
      const cutoff = this.now() - HASHTAG_WINDOW_MS;
      const recent = db.hashtagSearchAttempts.filter((item) => Date.parse(item.at) >= cutoff);
      const unique = new Set(recent.map((item) => item.hashtag.toLowerCase()));
      if (!unique.has(hashtag.toLowerCase()) && unique.size >= HASHTAG_LIMIT) throw new AppError('hashtag_quota_exhausted', 'The local rolling seven-day limit of 30 unique hashtag searches has been reached.', 429);
      db.hashtagSearchAttempts.unshift({ id: attemptId, hashtag, accountId: account.id, at, status: 'started' });
    });

    try {
      // The only account ID used in Graph is read from the connected-account record above.
      const found = await this.meta.searchInstagramHashtag({ instagramUserId: account.instagramUserId, userToken: bundle.userAccessToken, hashtag });
      const hashtagId = found.data?.[0]?.id;
      if (typeof hashtagId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(hashtagId)) {
        await this.#finishHashtagAttempt(attemptId, 'complete', null);
        return { collection: { id: attemptId, accountId: account.id, hashtag, fetchedAt: at, returnedCount: 0, newCandidateCount: 0, duplicateCount: 0, invalidCount: 0, limit: 25, quota: await this.hashtagQuota() }, candidates: [] };
      }
      const result = await this.meta.getInstagramHashtagRecentMedia({ instagramUserId: account.instagramUserId, userToken: bundle.userAccessToken, hashtagId });
      const rows = Array.isArray(result.data) ? result.data.slice(0, 25) : [];
      let duplicateCount = 0;
      let invalidCount = 0;
      const candidates = [];
      await this.store.transaction((db) => {
        db.discoveryCandidates ||= [];
        for (const row of rows) {
          const candidate = sourcePost(row, null, account.id, at, { type: 'hashtag', value: hashtag.toLowerCase() });
          if (!candidate) { invalidCount += 1; continue; }
          const existing = db.discoveryCandidates.find((saved) => saved.sourcePlatform === 'instagram' && saved.sourcePostId === candidate.sourcePostId);
          if (existing) {
            existing.lastSeenAt = at;
            existing.collectionCount = (existing.collectionCount || 1) + 1;
            existing.sourceAttributions ||= [];
            if (existing.sourceUsername && !existing.sourceAttributions.some((source) => source.type === 'business_discovery' && source.value.toLowerCase() === existing.sourceUsername.toLowerCase())) existing.sourceAttributions.unshift({ type: 'business_discovery', value: existing.sourceUsername.toLowerCase() });
            if (!existing.sourceAttributions.some((source) => source.type === 'hashtag' && source.value.toLowerCase() === hashtag.toLowerCase())) existing.sourceAttributions.push({ type: 'hashtag', value: hashtag.toLowerCase() });
            duplicateCount += 1;
            candidates.push(existing);
          } else {
            db.discoveryCandidates.unshift(candidate);
            candidates.push(candidate);
          }
        }
        db.activity.unshift({ id: randomUUID(), type: 'instagram_hashtag_collected', at, hashtag, accountId: account.id, returnedCount: rows.length, newCandidateCount: rows.length - duplicateCount - invalidCount, duplicateCount, invalidCount, resultLimit: 25 });
        const attempt = db.hashtagSearchAttempts.find((item) => item.id === attemptId);
        if (attempt) attempt.status = 'complete';
      });
      return { collection: { id: attemptId, accountId: account.id, hashtag, fetchedAt: at, returnedCount: rows.length, newCandidateCount: rows.length - duplicateCount - invalidCount, duplicateCount, invalidCount, limit: 25, quota: await this.hashtagQuota() }, candidates };
    } catch (error) {
      const code = typeof error?.code === 'string' && /^meta_[a-z0-9_-]{1,32}$/i.test(error.code) ? error.code : 'collection_failed';
      await this.#finishHashtagAttempt(attemptId, 'failed', code);
      throw error;
    }
  }

  async #finishHashtagAttempt(id, status, code) {
    await this.store.transaction((state) => {
      const attempt = (state.hashtagSearchAttempts || []).find((item) => item.id === id);
      if (attempt) { attempt.status = status; if (code) attempt.code = code; }
    });
  }

  async listCandidates() {
    const state = await this.store.read();
    return [...(state.discoveryCandidates || [])].sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt));
  }

  async collect(input) {
    if (!input || typeof input.accountId !== 'string' || input.accountId.length > 180) throw new AppError('invalid_request', 'Select a connected Instagram account.');
    if (typeof input.username !== 'string' || !USERNAME_RE.test(input.username)) throw new AppError('invalid_request', 'Enter a valid Instagram username without @.');
    const username = input.username;
    const state = await this.store.read();
    const account = state.accounts.find((row) => row.id === input.accountId && row.platform === 'instagram' && row.connected && row.instagramUserId);
    if (!account) throw new AppError('account_not_connected', 'Choose a connected Instagram professional account.', 401);

    const bundle = await this.oauth.tokenBundle();
    const missing = REQUIRED_PERMISSIONS.filter((permission) => !bundle.permissions?.includes(permission));
    if (missing.length) throw new AppError('permission_missing', `Meta permission ${missing[0]} is not granted.`, 403);
    if (typeof bundle.userAccessToken !== 'string' || !bundle.userAccessToken) throw new AppError('account_not_connected', 'The encrypted Facebook user token is unavailable.', 401);
    if (bundle.userTokenExpiresAt && (!Number.isFinite(Date.parse(bundle.userTokenExpiresAt)) || Date.parse(bundle.userTokenExpiresAt) <= this.now())) throw new AppError('reauth_required', 'The Facebook user token has expired or has an invalid expiry. Reconnect Meta before collecting sources.', 401);
    const linkedPage = bundle.pages?.find((page) => page.id === account.pageId && page.instagramUserId === account.instagramUserId);
    if (!linkedPage) throw new AppError('account_not_connected', 'The selected Instagram account is no longer linked to its Page.', 409);

    const fetchedAt = new Date(this.now()).toISOString();
    const result = await this.meta.getInstagramBusinessDiscovery({ instagramUserId: account.instagramUserId, userToken: bundle.userAccessToken, username });
    const returnedUsername = result.business_discovery?.username;
    if (typeof returnedUsername === 'string' && returnedUsername.toLowerCase() !== username.toLowerCase()) throw new AppError('discovery_username_mismatch', 'Meta returned a different source username than requested.', 502);
    const rows = Array.isArray(result.business_discovery?.media?.data) ? result.business_discovery.media.data.slice(0, 25) : [];
    const candidates = [];
    const collectionId = randomUUID();
    let duplicateCount = 0;
    let invalidCount = 0;
    await this.store.transaction((db) => {
      db.discoveryCandidates ||= [];
      for (const row of rows) {
        const candidate = sourcePost(row, username, account.id, fetchedAt);
        if (!candidate) { invalidCount += 1; continue; }
        const existing = db.discoveryCandidates.find((saved) => saved.sourcePlatform === 'instagram' && saved.sourcePostId === candidate.sourcePostId);
        if (existing) {
          existing.lastSeenAt = fetchedAt;
          existing.collectionCount = (existing.collectionCount || 1) + 1;
          existing.sourceAttributions ||= [];
          const source = { type: 'business_discovery', value: username.toLowerCase() };
          if (!existing.sourceAttributions.some((item) => item.type === source.type && item.value.toLowerCase() === source.value)) existing.sourceAttributions.push(source);
          duplicateCount += 1;
          candidates.push(existing);
        } else {
          db.discoveryCandidates.unshift(candidate);
          candidates.push(candidate);
        }
      }
      db.activity.unshift({ id: randomUUID(), type: 'instagram_discovery_collected', at: fetchedAt, collectionId, accountId: account.id, username, returnedCount: rows.length, newCandidateCount: rows.length - duplicateCount - invalidCount, duplicateCount, invalidCount, resultLimit: 25 });
    });
    return {
      collection: {
        id: collectionId, accountId: account.id, username, fetchedAt,
        returnedCount: rows.length, newCandidateCount: rows.length - duplicateCount - invalidCount,
        duplicateCount, invalidCount, limit: 25, moreResultsMayExist: true,
      },
      candidates,
    };
  }
}
