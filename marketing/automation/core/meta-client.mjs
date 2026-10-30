import { AppError } from './errors.mjs';

export class MetaApiError extends Error {
  constructor({ status = 502, code = 'meta_error', retryable = false }) {
    super('Meta API request failed.');
    this.name = 'MetaApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export class MetaClient {
  constructor({ config, fetchImpl = globalThis.fetch, timeoutMs = 20_000 }) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  authorizeUrl(state, codeChallenge) {
    this.#requireOAuth();
    const url = new URL(`https://www.facebook.com/${this.config.graphVersion}/dialog/oauth`);
    url.searchParams.set('client_id', this.config.appId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.config.scopes.join(','));
    url.searchParams.set('state', state);
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  }

  async exchangeCode(code, verifier) {
    this.#requireOAuth();
    const params = {
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      redirect_uri: this.config.redirectUri,
      code,
    };
    if (verifier) params.code_verifier = verifier;
    return this.#oauthGet(params);
  }

  async exchangeLongLivedUserToken(userToken) {
    this.#requireOAuth();
    return this.#oauthGet({
      grant_type: 'fb_exchange_token',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: userToken,
    });
  }

  async listPermissions(userToken) {
    const result = await this.#graph('me/permissions', { token: userToken });
    return Array.isArray(result.data)
      ? result.data.filter((item) => item.status === 'granted').map((item) => item.permission)
      : [];
  }

  async debugUserAccessToken(userToken) {
    this.#requireOAuth();
    const appAccessToken = `${this.config.appId}|${this.config.appSecret}`;
    return this.#graph('debug_token', { token: appAccessToken, params: { input_token: userToken } });
  }

  async listManagedPages(userToken) {
    const pages = [];
    let after = '';
    for (let page = 0; page < 5; page += 1) {
      const params = { fields: 'id,name,access_token,tasks,instagram_business_account' };
      if (after) params.after = after;
      const response = await this.#graph('me/accounts', { token: userToken, params });
      if (Array.isArray(response.data)) pages.push(...response.data);
      after = response.paging?.cursors?.after || '';
      if (!after || !response.paging?.next) break;
    }
    return pages.filter((page) => typeof page.id === 'string' && typeof page.access_token === 'string');
  }

  async createInstagramReel({ instagramUserId, pageToken, videoUrl, caption, shareToFeed = false }) {
    if (!/^https:/.test(videoUrl)) throw new AppError('media_not_public', 'A public HTTPS video URL is required.', 422);
    return this.#graph(`${encodeURIComponent(instagramUserId)}/media`, {
      method: 'POST',
      token: pageToken,
      body: { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: String(shareToFeed) },
    });
  }

  async createInstagramImage({ instagramUserId, pageToken, imageUrl, caption }) {
    if (!/^https:/.test(imageUrl)) throw new AppError('media_not_public', 'A public HTTPS image URL is required.', 422);
    return this.#graph(`${encodeURIComponent(instagramUserId)}/media`, {
      method: 'POST', token: pageToken,
      body: { image_url: imageUrl, caption },
    });
  }

  async createInstagramCarouselChild({ instagramUserId, pageToken, imageUrl }) {
    if (!/^https:/.test(imageUrl)) throw new AppError('media_not_public', 'A public HTTPS image URL is required.', 422);
    return this.#graph(`${encodeURIComponent(instagramUserId)}/media`, {
      method: 'POST', token: pageToken,
      body: { image_url: imageUrl, is_carousel_item: 'true' },
    });
  }

  async createInstagramCarousel({ instagramUserId, pageToken, children, caption }) {
    if (!Array.isArray(children) || children.length < 2 || children.length > 20) throw new AppError('invalid_media', 'Instagram carousels require 2 to 20 items.', 422);
    return this.#graph(`${encodeURIComponent(instagramUserId)}/media`, {
      method: 'POST', token: pageToken,
      body: { media_type: 'CAROUSEL', children: children.join(','), caption },
    });
  }

  async getInstagramContainer(containerId, pageToken) {
    return this.#graph(encodeURIComponent(containerId), {
      token: pageToken,
      params: { fields: 'status_code,status' },
    });
  }

  async publishInstagramContainer(instagramUserId, containerId, pageToken) {
    return this.#graph(`${encodeURIComponent(instagramUserId)}/media_publish`, {
      method: 'POST',
      token: pageToken,
      body: { creation_id: containerId },
    });
  }

  async getInstagramPublishingLimit(instagramUserId, pageToken) {
    return this.#graph(`${encodeURIComponent(instagramUserId)}/content_publishing_limit`, {
      token: pageToken,
      params: { fields: 'quota_usage,config' },
    });
  }

  async getInstagramBusinessDiscovery({ instagramUserId, userToken, username }) {
    if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) throw new AppError('invalid_request', 'Instagram username is invalid.');
    const fields = `business_discovery.username(${username}){username,media.limit(25){id,caption,permalink,timestamp,media_type,media_url}}`;
    return this.#graph(encodeURIComponent(instagramUserId), { token: userToken, params: { fields } });
  }

  async searchInstagramHashtag({ instagramUserId, userToken, hashtag }) {
    if (!/^[A-Za-z0-9_]{1,30}$/.test(hashtag)) throw new AppError('invalid_request', 'Instagram hashtag is invalid.');
    return this.#graph('ig_hashtag_search', { token: userToken, params: { user_id: instagramUserId, q: hashtag } });
  }

  async getInstagramHashtagRecentMedia({ instagramUserId, userToken, hashtagId }) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(hashtagId)) throw new AppError('invalid_request', 'Instagram hashtag ID is invalid.');
    return this.#graph(`${encodeURIComponent(hashtagId)}/recent_media`, {
      token: userToken,
      params: { user_id: instagramUserId, fields: 'id,caption,timestamp,permalink,media_type', limit: '25' },
    });
  }

  async uploadFacebookPhoto({ pageId, pageToken, imageUrl }) {
    if (!/^https:/.test(imageUrl)) throw new AppError('media_not_public', 'A public HTTPS image URL is required.', 422);
    return this.#graph(`${encodeURIComponent(pageId)}/photos`, {
      method: 'POST', token: pageToken,
      body: { url: imageUrl, published: 'false' },
    });
  }

  async publishFacebookPhoto({ pageId, pageToken, imageUrl, caption }) {
    if (!/^https:/.test(imageUrl)) throw new AppError('media_not_public', 'A public HTTPS image URL is required.', 422);
    return this.#graph(`${encodeURIComponent(pageId)}/photos`, {
      method: 'POST', token: pageToken,
      body: { url: imageUrl, caption, published: 'true' },
    });
  }

  async publishFacebookFeed({ pageId, pageToken, message, attachedMedia = [], link = '' }) {
    const body = { message, published: 'true' };
    if (link) body.link = link;
    if (attachedMedia.length) body.attached_media = JSON.stringify(attachedMedia.map((mediaFbid) => ({ media_fbid: mediaFbid })));
    return this.#graph(`${encodeURIComponent(pageId)}/feed`, { method: 'POST', token: pageToken, body });
  }

  async getFacebookPost(postId, pageToken) {
    return this.#graph(encodeURIComponent(postId), { token: pageToken, params: { fields: 'id,created_time,permalink_url' } });
  }

  async #oauthGet(params) {
    const url = new URL(`https://graph.facebook.com/${this.config.graphVersion}/oauth/access_token`);
    for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
    const result = await this.#request(url, { method: 'GET' });
    if (typeof result.access_token !== 'string') throw new MetaApiError({ code: 'meta_oauth_error' });
    return result;
  }

  async #graph(path, { token, params = {}, body, method = 'GET' }) {
    if (!this.config.graphVersion) throw new AppError('graph_version_unconfigured', 'Set a verified Meta Graph API version before connecting.', 503);
    if (!token) throw new AppError('account_not_connected', 'Connect a Meta account first.', 401);
    const url = new URL(`https://graph.facebook.com/${this.config.graphVersion}/${path}`);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(key, value);
    const headers = { Accept: 'application/json' };
    let requestBody;
    if (method === 'GET') {
      url.searchParams.set('access_token', token);
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const form = new URLSearchParams({ ...body, access_token: token });
      requestBody = form.toString();
    }
    return this.#request(url, { method, headers, body: requestBody });
  }

  async #request(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...options, signal: controller.signal, redirect: 'error' });
      let payload;
      try { payload = await response.json(); } catch { payload = {}; }
      if (!response.ok || payload.error) {
        const code = payload.error?.code ? `meta_${String(payload.error.code).replace(/[^0-9a-z_-]/gi, '').slice(0, 24)}` : 'meta_error';
        throw new MetaApiError({ status: response.status, code, retryable: response.status >= 500 || response.status === 429 });
      }
      return payload;
    } catch (error) {
      if (error instanceof MetaApiError || error instanceof AppError) throw error;
      const timeouted = error?.name === 'AbortError';
      throw new MetaApiError({ status: timeouted ? 504 : 502, code: timeouted ? 'meta_timeout' : 'meta_unreachable', retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }

  #requireOAuth() {
    if (!this.config.oauthReady) throw new AppError('oauth_not_configured', 'Meta OAuth is not configured.', 503);
  }
}
