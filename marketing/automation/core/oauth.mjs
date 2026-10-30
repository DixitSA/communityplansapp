import { createHash, randomBytes } from 'node:crypto';
import { AppError } from './errors.mjs';

function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export class OAuthFlow {
  constructor({ config, meta, store, vault, now = () => Date.now() }) {
    this.config = config;
    this.meta = meta;
    this.store = store;
    this.vault = vault;
    this.now = now;
    this.pending = new Map();
  }

  start() {
    if (!this.config.oauthReady || !this.vault.available) throw new AppError('oauth_not_configured', 'Meta OAuth requires app credentials, reviewed scopes, a verified API version, and the token-encryption key.', 503);
    const state = randomBytes(32).toString('base64url');
    const pair = this.config.pkceEnabled ? pkcePair() : null;
    this.pending.set(state, { verifier: pair?.verifier ?? null, expiresAt: this.now() + 10 * 60 * 1000 });
    return this.meta.authorizeUrl(state, pair?.challenge);
  }

  async finish({ state, code, error }) {
    this.#prune();
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (!entry || entry.expiresAt <= this.now()) throw new AppError('oauth_state_invalid', 'Login state is invalid or expired. Start again from this dashboard.', 400);
    if (error || !code || typeof code !== 'string' || code.length > 4096) throw new AppError('oauth_denied', 'Meta authorization was not completed.', 400);
    const short = await this.meta.exchangeCode(code, entry.verifier);
    const long = await this.meta.exchangeLongLivedUserToken(short.access_token);
    const userToken = long.access_token;
    const [permissions, pages] = await Promise.all([
      this.meta.listPermissions(userToken),
      this.meta.listManagedPages(userToken),
    ]);
    const expiresAt = Number.isFinite(Number(long.expires_in)) ? new Date(this.now() + Number(long.expires_in) * 1000).toISOString() : null;
    const credentialBundle = {
      userAccessToken: userToken,
      userTokenExpiresAt: expiresAt,
      permissions,
      pages: pages.map((page) => ({
        id: page.id,
        name: String(page.name || 'Facebook Page').slice(0, 160),
        tasks: Array.isArray(page.tasks) ? page.tasks : [],
        pageAccessToken: page.access_token,
        instagramUserId: page.instagram_business_account?.id || null,
        instagramAccountType: page.instagram_business_account?.account_type || null,
      })),
      connectedAt: new Date(this.now()).toISOString(),
    };
    const publicAccounts = credentialBundle.pages.flatMap((page) => [
      { id: `facebook:${page.id}`, platform: 'facebook', pageId: page.id, name: page.name, tasks: page.tasks, permissions: credentialBundle.permissions, connected: true },
      ...(page.instagramUserId ? [{ id: `instagram:${page.instagramUserId}`, platform: 'instagram', pageId: page.id, instagramUserId: page.instagramUserId, name: page.name, accountType: page.instagramAccountType || 'professional', tasks: page.tasks, permissions: credentialBundle.permissions, connected: true }] : []),
    ]);
    if (!credentialBundle.pages.length) throw new AppError('meta_page_not_found', 'No managed Facebook Page was returned. Check account roles and linked Instagram setup.', 422);
    await this.store.transaction((db) => {
      db.encryptedTokens = this.vault.encrypt(credentialBundle);
      db.accounts = publicAccounts;
      db.activity.unshift({ id: cryptoId(), type: 'meta_connected', at: new Date(this.now()).toISOString(), accounts: publicAccounts.map((account) => account.id) });
    });
    return publicAccounts;
  }

  async importUserToken({ userToken, pageId }) {
    if (!this.config.oauthReady || !this.vault.available) throw new AppError('oauth_not_configured', 'Meta app credentials and token encryption must be configured before importing a token.', 503);
    if (typeof userToken !== 'string' || userToken.length < 20 || userToken.length > 8192 || /\s/.test(userToken)) throw new AppError('invalid_user_token', 'Provide one Facebook user access token through stdin.', 400);
    if (typeof pageId !== 'string' || !/^\d{1,32}$/.test(pageId)) throw new AppError('invalid_page_id', 'Provide the exact numeric Yard Page ID with --page-id.', 400);

    const verify = async (token) => {
      const result = await this.meta.debugUserAccessToken(token);
      const data = result?.data;
      if (!data || data.is_valid !== true) throw new AppError('user_token_invalid', 'Meta did not validate this user token.', 401);
      if (String(data.app_id || '') !== String(this.config.appId)) throw new AppError('user_token_wrong_app', 'The token belongs to a different Meta app.', 401);
      if (data.type !== 'USER') throw new AppError('user_token_wrong_type', 'Only a Facebook USER access token can be imported.', 401);
      const expirySeconds = Number(data.expires_at);
      if (!Number.isFinite(expirySeconds) || expirySeconds <= Math.floor(this.now() / 1000)) throw new AppError('user_token_expired', 'The user token has expired or Meta returned no valid expiry.', 401);
      return expirySeconds;
    };

    await verify(userToken);
    const long = await this.meta.exchangeLongLivedUserToken(userToken);
    if (typeof long?.access_token !== 'string' || !long.access_token || long.access_token.length > 8192) throw new AppError('user_token_exchange_failed', 'Meta did not return a long-lived user token.', 502);
    const verifiedLongExpiry = await verify(long.access_token);
    const [permissions, pages] = await Promise.all([
      this.meta.listPermissions(long.access_token),
      this.meta.listManagedPages(long.access_token),
    ]);
    const page = pages.find((candidate) => candidate.id === pageId && typeof candidate.access_token === 'string' && candidate.instagram_business_account?.id);
    if (!page) throw new AppError('yard_page_not_found', 'The exact Yard Page ID was not returned with a linked Instagram professional account. No token was saved.', 422);
    const connectedAt = new Date(this.now()).toISOString();
    const credentialBundle = {
      userAccessToken: long.access_token,
      userTokenExpiresAt: new Date(verifiedLongExpiry * 1000).toISOString(),
      permissions: Array.isArray(permissions) ? permissions : [],
      pages: [{
        id: page.id,
        name: String(page.name || 'Facebook Page').slice(0, 160),
        tasks: Array.isArray(page.tasks) ? page.tasks : [],
        pageAccessToken: page.access_token,
        instagramUserId: page.instagram_business_account.id,
        instagramAccountType: page.instagram_business_account.account_type || null,
      }],
      allowedPageIds: [page.id],
      connectedAt,
    };
    const publicAccounts = [
      { id: `facebook:${page.id}`, platform: 'facebook', pageId: page.id, name: credentialBundle.pages[0].name, tasks: credentialBundle.pages[0].tasks, permissions: credentialBundle.permissions, connected: true },
      { id: `instagram:${credentialBundle.pages[0].instagramUserId}`, platform: 'instagram', pageId: page.id, instagramUserId: credentialBundle.pages[0].instagramUserId, name: credentialBundle.pages[0].name, accountType: credentialBundle.pages[0].instagramAccountType || 'professional', tasks: credentialBundle.pages[0].tasks, permissions: credentialBundle.permissions, connected: true },
    ];
    await this.store.transaction((db) => {
      db.encryptedTokens = this.vault.encrypt(credentialBundle);
      db.accounts = publicAccounts;
      db.activity.unshift({ id: cryptoId(), type: 'meta_connected_cli', at: connectedAt, accounts: publicAccounts.map((account) => account.id) });
    });
    return publicAccounts;
  }

  async disconnect() {
    await this.store.transaction((db) => {
      db.encryptedTokens = null;
      db.accounts = [];
      db.activity.unshift({ id: cryptoId(), type: 'meta_disconnected', at: new Date(this.now()).toISOString() });
    });
  }

  async tokenBundle() {
    const state = await this.store.read();
    if (!state.encryptedTokens) throw new AppError('account_not_connected', 'Connect a Meta account first.', 401);
    const bundle = this.vault.decrypt(state.encryptedTokens);
    if (state.encryptedTokens.keyId !== this.vault.current?.id) {
      await this.store.transaction((db) => { db.encryptedTokens = this.vault.encrypt(bundle); });
    }
    return bundle;
  }

  async refresh() {
    const old = await this.tokenBundle();
    const oldExpiry = Date.parse(old.userTokenExpiresAt || '');
    if (!Number.isFinite(oldExpiry) || oldExpiry <= this.now()) {
      throw new AppError('reauth_required', 'The user token is expired or has no known expiry. Reconnect Meta.', 401);
    }
    const refreshed = await this.meta.exchangeLongLivedUserToken(old.userAccessToken);
    const userAccessToken = refreshed.access_token;
    const expiresIn = Number(refreshed.expires_in);
    if (typeof userAccessToken !== 'string' || !userAccessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new AppError('user_token_refresh_invalid', 'Meta did not return a refreshed user token with a valid expiry.', 502);
    }
    const expiresAt = new Date(this.now() + expiresIn * 1000).toISOString();
    const [permissions, discoveredPages] = await Promise.all([this.meta.listPermissions(userAccessToken), this.meta.listManagedPages(userAccessToken)]);
    const allowedPageIds = Array.isArray(old.allowedPageIds) ? old.allowedPageIds : null;
    const pages = allowedPageIds ? discoveredPages.filter((page) => allowedPageIds.includes(page.id)) : discoveredPages;
    if (allowedPageIds?.length && !pages.some((page) => allowedPageIds.includes(page.id))) {
      throw new AppError('yard_page_not_found', 'The selected Page was not returned during token refresh. Existing encrypted connection was left unchanged.', 422);
    }
    const bundle = {
      ...old,
      userAccessToken,
      userTokenExpiresAt: expiresAt,
      permissions,
      pages: pages.map((page) => ({
        id: page.id,
        name: String(page.name || 'Facebook Page').slice(0, 160),
        tasks: Array.isArray(page.tasks) ? page.tasks : [],
        pageAccessToken: page.access_token,
        instagramUserId: page.instagram_business_account?.id || null,
        instagramAccountType: page.instagram_business_account?.account_type || null,
      })),
      connectedAt: old.connectedAt,
    };
    const accounts = bundle.pages.flatMap((page) => [
      { id: `facebook:${page.id}`, platform: 'facebook', pageId: page.id, name: page.name, tasks: page.tasks, permissions, connected: true },
      ...(page.instagramUserId ? [{ id: `instagram:${page.instagramUserId}`, platform: 'instagram', pageId: page.id, instagramUserId: page.instagramUserId, name: page.name, accountType: page.instagramAccountType || 'professional', tasks: page.tasks, permissions, connected: true }] : []),
    ]);
    await this.store.transaction((db) => {
      db.encryptedTokens = this.vault.encrypt(bundle);
      db.accounts = accounts;
      db.activity.unshift({ id: cryptoId(), type: 'meta_token_rotated', at: new Date(this.now()).toISOString() });
    });
    return { expiresAt, accounts };
  }

  #prune() {
    const now = this.now();
    for (const [key, value] of this.pending) if (value.expiresAt <= now) this.pending.delete(key);
  }
}

function cryptoId() {
  return randomBytes(16).toString('hex');
}
