import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './errors.mjs';

const required = {
  facebook: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
  instagram: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
};
const MAX_MEDIA_BYTES = 150_000_000;

function captionFor(draft) {
  return [draft.caption, ...(draft.hashtags || []), draft.cta].filter(Boolean).join('\n\n');
}

function contentSnapshot(draft, assets) {
  return {
    id: draft.id, type: draft.type, title: draft.title, format: draft.format,
    caption: draft.caption, hashtags: draft.hashtags, cta: draft.cta,
    platforms: draft.platforms, durationSeconds: draft.durationSeconds,
    slides: draft.slides.map(({ headline, body }) => ({ headline, body })),
    timestampedScript: draft.timestampedScript, shotList: draft.shotList,
    mediaPurpose: draft.mediaPurpose, mediaDisclosure: draft.mediaDisclosure,
    assets: assets.map(({ name, sha256, mimeType, index }) => ({ name, sha256, mimeType, index })),
  };
}

function hostedAssetUrl(baseUrl, asset) {
  return new URL(`${asset.sha256}/${encodeURIComponent(asset.name)}`, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

export class ApprovalService {
  constructor({ config, store, drafts, oauth, meta, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
    Object.assign(this, { config, store, drafts, oauth, meta, fetchImpl, now });
    this.running = new Set();
  }

  async create(input) {
    const draft = await this.drafts.get(input.draftId);
    if (draft.revision !== input.revision || draft.contentSha256 !== input.contentSha256) throw new AppError('approval_mismatch', 'Draft revision or media changed. Reload before approval.', 409);
    if (!['instagram', 'facebook'].includes(input.target?.platform) || !draft.platforms.includes(input.target.platform)) throw new AppError('invalid_request', 'Choose a supported target platform for this draft.');
    if (typeof input.approver !== 'string' || !input.approver.trim() || input.approver.length > 120) throw new AppError('invalid_request', 'Approver identity is required.');
    if (!['publish_now', 'schedule'].includes(input.action)) throw new AppError('invalid_request', 'Choose publish_now or schedule.');
    if (input.action === 'publish_now' && input.scheduledAt !== null) throw new AppError('invalid_request', 'Publish now requires a null scheduledAt.');
    if (input.action === 'schedule' && (typeof input.scheduledAt !== 'string' || !Number.isFinite(Date.parse(input.scheduledAt)) || new Date(input.scheduledAt).toISOString() !== input.scheduledAt || Date.parse(input.scheduledAt) <= this.now())) throw new AppError('invalid_request', 'Schedule time must be a future ISO-8601 timestamp.');
    const account = await this.#account(input.target.platform, input.target.accountId);
    this.#assertCaptionLength(draft, account.platform);
    await this.#validateCapability(draft, account);
    const assets = await this.drafts.assetsFor(draft.id);
    const verifiedDraft = await this.drafts.get(draft.id);
    if (verifiedDraft.revision !== draft.revision || verifiedDraft.contentSha256 !== draft.contentSha256) throw new AppError('approval_mismatch', 'Draft or media changed while approval was being prepared.', 409);
    if (!assets.length || assets.some((asset) => !asset.sha256)) throw new AppError('asset_missing', 'Rendered media is required.', 422);
    const approval = {
      id: randomUUID(), draftId: draft.id, revision: draft.revision, contentSha256: draft.contentSha256,
      action: input.action, scheduledAt: input.action === 'schedule' ? new Date(input.scheduledAt).toISOString() : null,
      approver: input.approver.trim(), approvedAt: new Date(this.now()).toISOString(), status: 'approved',
      createdAt: new Date(this.now()).toISOString(),
      target: { platform: account.platform, accountId: account.id, accountName: account.name, pageId: account.pageId || null, instagramUserId: account.instagramUserId || null },
      assetHashes: assets.map(({ name, sha256, mimeType, index }) => ({ name, sha256, mimeType, index })),
      contentSnapshot: contentSnapshot(draft, assets),
    };
    await this.store.transaction((state) => {
      state.approvals.unshift(approval);
      state.activity.unshift({ id: randomUUID(), type: 'approval_created', at: approval.approvedAt, approvalId: approval.id, draftId: draft.id, accountId: account.id, contentSha256: draft.contentSha256 });
    });
    return approval;
  }

  async revoke(id, reason = '') {
    return this.store.transaction((state) => {
      const approval = state.approvals.find((item) => item.id === id);
      if (!approval) throw new AppError('not_found', 'Approval not found.', 404);
      if (approval.status !== 'approved' || state.attempts.some((attempt) => attempt.approvalId === id)) throw new AppError('approval_not_revokeable', 'This approval can no longer be revoked.', 409);
      approval.status = 'revoked'; approval.revokedAt = new Date(this.now()).toISOString();
      approval.revocationReason = String(reason).slice(0, 500);
      state.activity.unshift({ id: randomUUID(), type: 'approval_revoked', at: approval.revokedAt, approvalId: id });
      return approval;
    });
  }

  async execute(id, { scheduled = false } = {}) {
    if (!this.config.publishingEnabled) throw new AppError('publishing_disabled', 'Publishing is disabled in server configuration.', 403);
    const state = await this.store.read();
    const approval = state.approvals.find((item) => item.id === id);
    if (!approval) throw new AppError('not_found', 'Approval not found.', 404);
    if (approval.status !== 'approved') throw new AppError(approval.status === 'outcome_unknown' ? 'outcome_unknown' : 'approval_not_active', 'This approval is not executable.', 409);
    if (approval.action === 'schedule' && Date.parse(approval.scheduledAt) > this.now()) throw new AppError('scheduled_not_due', 'This approved schedule is not due yet.', 409);
    if (approval.action === 'publish_now' && approval.scheduledAt !== null) throw new AppError('approval_mismatch', 'Publish-now approval contains a schedule time.', 409);
    if (approval.action === 'publish_now' && scheduled) throw new AppError('invalid_request', 'Only approved schedule records can run from the scheduler.');
    const draft = await this.drafts.get(approval.draftId);
    if (draft.revision !== approval.revision || draft.contentSha256 !== approval.contentSha256) throw new AppError('approval_mismatch', 'Draft changed after approval.', 409);
    const account = await this.#account(approval.target.platform, approval.target.accountId);
    await this.#validateCapability(draft, account);
    this.#assertCaptionLength(draft, account.platform);
    const assets = await this.drafts.assetsFor(draft.id);
    if (JSON.stringify(assets.map(({ name, sha256, mimeType, index }) => ({ name, sha256, mimeType, index }))) !== JSON.stringify(approval.assetHashes)) throw new AppError('approval_mismatch', 'Approved media bytes changed.', 409);
    const lockKey = this.#lockKey(approval);
    const lockCheck = await this.store.transaction((db) => {
      const currentApproval = db.approvals.find((item) => item.id === id);
      const storedDraft = db.drafts[draft.id];
      const currentAccount = db.accounts.find((item) => item.id === account.id && item.platform === account.platform && item.connected);
      if (!currentApproval || currentApproval.status !== 'approved') throw new AppError('approval_not_active', 'Approval was revoked or is no longer available.', 409);
      if (currentApproval.revision !== approval.revision || currentApproval.contentSha256 !== approval.contentSha256 || currentApproval.action !== approval.action || currentApproval.scheduledAt !== approval.scheduledAt || JSON.stringify(currentApproval.target) !== JSON.stringify(approval.target)) throw new AppError('approval_mismatch', 'Approval changed before execution began.', 409);
      if (!storedDraft || storedDraft.revision !== approval.revision || !currentAccount) throw new AppError('approval_mismatch', 'The approved draft or account is no longer current.', 409);
      if (currentApproval.action === 'publish_now' && currentApproval.scheduledAt !== null) throw new AppError('approval_mismatch', 'Publish-now approval contains a schedule time.', 409);
      if (currentApproval.action === 'schedule' && Date.parse(currentApproval.scheduledAt) > this.now()) throw new AppError('scheduled_not_due', 'This approved schedule is not due yet.', 409);
      const duplicate = db.attempts.find((attempt) => attempt.lockKey === lockKey && ['preparing', 'outcome_unknown', 'complete'].includes(attempt.status));
      if (duplicate) throw new AppError(duplicate.status === 'outcome_unknown' ? 'outcome_unknown' : 'duplicate_locked', 'This exact publish action is already locked.', 409);
      currentApproval.status = 'executing';
      currentApproval.executionStartedAt = new Date(this.now()).toISOString();
      const attempt = { id: randomUUID(), approvalId: id, draftId: draft.id, lockKey, status: 'preparing', startedAt: new Date(this.now()).toISOString(), platform: account.platform, accountId: account.id, revision: approval.revision, contentSha256: approval.contentSha256, step: 'validated', remoteIds: [] };
      db.attempts.unshift(attempt);
      db.activity.unshift({ id: randomUUID(), type: 'publish_attempt_started', at: attempt.startedAt, attemptId: attempt.id, approvalId: id });
      return attempt;
    });

    try {
      await this.#verifyRemoteAssets(assets);
      const tokens = await this.oauth.tokenBundle();
      const page = tokens.pages.find((row) => row.id === account.pageId);
      if (!page?.pageAccessToken) throw new AppError('account_not_connected', 'Connected Page token is unavailable.', 401);
      const result = await this.#publish({ approval, draft, assets, account, page, attemptId: lockCheck.id });
      const finishedAt = new Date(this.now()).toISOString();
      await this.store.transaction((db) => {
        const attempt = db.attempts.find((row) => row.id === lockCheck.id);
        attempt.status = 'complete'; attempt.finishedAt = finishedAt; attempt.remoteIds = result.remoteIds || []; attempt.result = result.summary || null;
        const currentApproval = db.approvals.find((row) => row.id === id); currentApproval.status = 'published'; currentApproval.publishedAt = finishedAt;
        db.activity.unshift({ id: randomUUID(), type: 'publish_complete', at: finishedAt, attemptId: attempt.id, approvalId: id, platform: account.platform, remoteIds: attempt.remoteIds });
      });
      return { attempt: (await this.store.read()).attempts.find((row) => row.id === lockCheck.id) };
    } catch (error) {
      const uncertain = error?.retryable === true || String(error?.code || '').startsWith('meta_') || error?.code === 'network_error';
      const at = new Date(this.now()).toISOString();
      await this.store.transaction((db) => {
        const attempt = db.attempts.find((row) => row.id === lockCheck.id);
        attempt.status = uncertain ? 'outcome_unknown' : 'failed'; attempt.finishedAt = at; attempt.errorCode = error?.code || 'internal_error';
        const currentApproval = db.approvals.find((row) => row.id === id); currentApproval.status = uncertain ? 'outcome_unknown' : 'failed';
        db.activity.unshift({ id: randomUUID(), type: uncertain ? 'publish_outcome_unknown' : 'publish_failed', at, attemptId: attempt.id, approvalId: id, errorCode: attempt.errorCode });
      });
      throw error;
    }
  }

  async runDueSchedules() {
    const state = await this.store.read();
    const due = state.approvals.filter((item) => item.status === 'approved' && item.action === 'schedule' && Date.parse(item.scheduledAt) <= this.now());
    const results = [];
    for (const item of due) {
      if (this.running.has(item.id)) continue;
      this.running.add(item.id);
      try { results.push(await this.execute(item.id, { scheduled: true })); }
      catch { /* durable activity records the outcome; scheduler never retries unknowns */ }
      finally { this.running.delete(item.id); }
    }
    return results;
  }

  async resolveUnknown(id, input) {
    if (!['confirmed_published', 'confirmed_not_published'].includes(input.resolution) || typeof input.reviewer !== 'string' || !input.reviewer.trim() || typeof input.note !== 'string' || !input.note.trim()) throw new AppError('invalid_request', 'Resolution, reviewer, and note are required.');
    return this.store.transaction((state) => {
      const attempt = state.attempts.find((row) => row.id === id);
      if (!attempt || attempt.status !== 'outcome_unknown') throw new AppError('not_found', 'Unresolved attempt not found.', 404);
      attempt.resolution = { outcome: input.resolution, reviewer: input.reviewer.trim(), note: input.note.trim().slice(0, 1000), at: new Date(this.now()).toISOString() };
      attempt.status = input.resolution === 'confirmed_published' ? 'complete' : 'resolved_not_published';
      const approval = state.approvals.find((row) => row.id === attempt.approvalId);
      if (approval) approval.status = input.resolution === 'confirmed_published' ? 'published' : 'resolved_not_published';
      state.activity.unshift({ id: randomUUID(), type: 'outcome_resolved', at: attempt.resolution.at, attemptId: id, approvalId: attempt.approvalId, outcome: input.resolution });
      return attempt;
    });
  }

  async recoverInFlight() {
    return this.store.transaction((state) => {
      const at = new Date(this.now()).toISOString();
      const recovered = [];
      for (const attempt of state.attempts) {
        if (attempt.status !== 'preparing') continue;
        attempt.status = 'outcome_unknown'; attempt.finishedAt = at; attempt.errorCode = 'server_interrupted';
        const approval = state.approvals.find((item) => item.id === attempt.approvalId);
        if (approval) approval.status = 'outcome_unknown';
        state.activity.unshift({ id: randomUUID(), type: 'publish_outcome_unknown', at, attemptId: attempt.id, approvalId: attempt.approvalId, errorCode: 'server_interrupted' });
        recovered.push(attempt.id);
      }
      return recovered;
    });
  }

  async #publish({ approval, draft, assets, account, page, attemptId }) {
    const caption = captionFor(draft);
    const urls = assets.map((asset) => hostedAssetUrl(this.config.mediaBaseUrl, asset));
    if (account.platform === 'facebook') {
      if (draft.type === 'reel') throw new AppError('unsupported_action', 'Facebook video publishing is not enabled in this build.', 501);
      if (draft.type === 'feed' && assets.length > 1) {
        const ids = [];
        for (const url of urls) {
          await this.#setStep(attemptId, `facebook_photo_upload_${ids.length + 1}`);
          const photo = await this.meta.uploadFacebookPhoto({ pageId: account.pageId, pageToken: page.pageAccessToken, imageUrl: url });
          if (!photo.id) throw new AppError('meta_response_invalid', 'Meta did not return a photo ID.', 502);
          ids.push(photo.id); await this.#saveRemoteId(attemptId, photo.id);
        }
        await this.#setStep(attemptId, 'facebook_carousel_publish');
        const post = await this.meta.publishFacebookFeed({ pageId: account.pageId, pageToken: page.pageAccessToken, message: caption, attachedMedia: ids });
        return { remoteIds: [...ids, post.id].filter(Boolean), summary: { postId: post.id || null, photoIds: ids } };
      }
      if (assets.length === 1) {
        await this.#setStep(attemptId, 'facebook_photo_publish');
        const photo = await this.meta.publishFacebookPhoto({ pageId: account.pageId, pageToken: page.pageAccessToken, imageUrl: urls[0], caption });
        if (!photo.post_id && !photo.id) throw new AppError('meta_response_invalid', 'Meta did not return a photo or post ID.', 502);
        return { remoteIds: [photo.post_id || photo.id].filter(Boolean), summary: { postId: photo.post_id || null, photoId: photo.id || null } };
      }
      await this.#setStep(attemptId, 'facebook_text_publish');
      const post = await this.meta.publishFacebookFeed({ pageId: account.pageId, pageToken: page.pageAccessToken, message: caption });
      if (!post.id) throw new AppError('meta_response_invalid', 'Meta did not return a Page post ID.', 502);
      return { remoteIds: [post.id].filter(Boolean), summary: { postId: post.id || null } };
    }
    if (account.platform === 'instagram') {
      if (draft.type === 'reel') {
        if (assets.length !== 1 || assets[0].mimeType !== 'video/mp4') throw new AppError('invalid_media', 'Instagram Reel needs one MP4 asset.', 422);
        await this.#checkQuota(account.instagramUserId, page.pageAccessToken);
        await this.#setStep(attemptId, 'instagram_reel_container');
        const container = await this.meta.createInstagramReel({ instagramUserId: account.instagramUserId, pageToken: page.pageAccessToken, videoUrl: urls[0], caption, shareToFeed: true });
        if (!container.id) throw new AppError('meta_response_invalid', 'Meta did not return a container ID.', 502);
        await this.#saveRemoteId(attemptId, container.id);
        const status = await this.#pollContainer(container.id, page.pageAccessToken);
        if (status !== 'FINISHED') throw new AppError('media_container_not_ready', 'Instagram Reel container did not finish processing.', 409);
        await this.#setStep(attemptId, 'instagram_reel_publish');
        const published = await this.meta.publishInstagramContainer({ instagramUserId: account.instagramUserId, containerId: container.id, pageToken: page.pageAccessToken });
        return { remoteIds: [container.id, published.id].filter(Boolean), summary: { containerId: container.id, mediaId: published.id || null } };
      }
      if (!assets.every((asset) => asset.mimeType === 'image/jpeg')) throw new AppError('invalid_media', 'Instagram image publishing requires reviewed JPEG assets.', 422);
      await this.#checkQuota(account.instagramUserId, page.pageAccessToken);
      if (assets.length === 1) {
        await this.#setStep(attemptId, 'instagram_image_container');
        const container = await this.meta.createInstagramImage({ instagramUserId: account.instagramUserId, pageToken: page.pageAccessToken, imageUrl: urls[0], caption });
        if (!container.id) throw new AppError('meta_response_invalid', 'Meta did not return a container ID.', 502);
        await this.#saveRemoteId(attemptId, container.id);
        await this.#setStep(attemptId, 'instagram_image_publish');
        const published = await this.meta.publishInstagramContainer({ instagramUserId: account.instagramUserId, containerId: container.id, pageToken: page.pageAccessToken });
        if (!published.id) throw new AppError('meta_response_invalid', 'Meta did not return a published media ID.', 502);
        return { remoteIds: [container.id, published.id].filter(Boolean), summary: { containerId: container.id, mediaId: published.id || null } };
      }
      if (assets.length > 20) throw new AppError('invalid_media', 'Instagram carousels support at most 20 images.', 422);
      const children = [];
      for (const url of urls) {
        await this.#setStep(attemptId, `instagram_carousel_child_${children.length + 1}`);
        const child = await this.meta.createInstagramCarouselChild({ instagramUserId: account.instagramUserId, pageToken: page.pageAccessToken, imageUrl: url });
        if (!child.id) throw new AppError('meta_response_invalid', 'Meta did not return a carousel child ID.', 502);
        children.push(child.id); await this.#saveRemoteId(attemptId, child.id);
      }
      await this.#setStep(attemptId, 'instagram_carousel_container');
      const container = await this.meta.createInstagramCarousel({ instagramUserId: account.instagramUserId, pageToken: page.pageAccessToken, children, caption });
      if (!container.id) throw new AppError('meta_response_invalid', 'Meta did not return a carousel container ID.', 502);
      await this.#saveRemoteId(attemptId, container.id);
      if (await this.#pollContainer(container.id, page.pageAccessToken) !== 'FINISHED') throw new AppError('media_container_not_ready', 'Instagram carousel container did not finish processing.', 409);
      await this.#setStep(attemptId, 'instagram_carousel_publish');
      const published = await this.meta.publishInstagramContainer({ instagramUserId: account.instagramUserId, containerId: container.id, pageToken: page.pageAccessToken });
      return { remoteIds: [...children, container.id, published.id].filter(Boolean), summary: { containerId: container.id, mediaId: published.id || null, childIds: children } };
    }
    throw new AppError('unsupported_action', 'This platform action is not implemented.', 501);
  }

  async #checkQuota(userId, token) {
    const result = await this.meta.getInstagramPublishingLimit(userId, token);
    const data = Array.isArray(result.data) ? result.data[0] : result;
    const used = Number(data.quota_usage); const limit = Number(data.config?.quota_total || data.config?.quota_total_count);
    if (!Number.isFinite(used) || !Number.isFinite(limit) || used >= limit) throw new AppError('instagram_quota_unavailable', 'Instagram publishing quota is unavailable or exhausted.', 429);
  }

  async #pollContainer(id, token) {
    for (let i = 0; i < 15; i += 1) {
      const result = await this.meta.getInstagramContainer(id, token);
      const status = String(result.status_code || '').toUpperCase();
      if (status === 'FINISHED') return status;
      if (['ERROR', 'EXPIRED'].includes(status)) throw new AppError('media_container_failed', 'Instagram could not process the approved media.', 422);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new AppError('media_container_timeout', 'Instagram media processing timed out before publish.', 504);
  }

  async #verifyRemoteAssets(assets) {
    const base = new URL(this.config.mediaBaseUrl);
    if (base.protocol !== 'https:' || !base.hostname || base.username || base.password) throw new AppError('media_host_invalid', 'A public HTTPS media host is required.', 503);
    const addresses = isIP(base.hostname) ? [{ address: base.hostname }] : await lookup(base.hostname, { all: true }).catch(() => []);
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new AppError('media_host_invalid', 'Media host must resolve only to public addresses.', 503);
    for (const asset of assets) {
      const url = new URL(`${asset.sha256}/${encodeURIComponent(asset.name)}`, `${base.toString().replace(/\/$/, '')}/`);
      const response = await this.fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new AppError('media_host_unavailable', 'Approved media is not available at the public media URL.', 424);
      const statedLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(statedLength) && statedLength > MAX_MEDIA_BYTES) throw new AppError('media_too_large', 'Hosted media exceeds the local verification limit.', 413);
      const chunks = []; let size = 0;
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > MAX_MEDIA_BYTES) throw new AppError('media_too_large', 'Hosted media exceeds the local verification limit.', 413);
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks, size);
      const { sha256 } = await import('./canonical.mjs');
      if (sha256(bytes) !== asset.sha256) throw new AppError('media_host_mismatch', 'Public media bytes do not match the approved asset.', 409);
    }
  }

  async #account(platform, id) {
    const state = await this.store.read();
    const account = state.accounts.find((item) => item.id === id && item.platform === platform && item.connected);
    if (!account) throw new AppError('account_not_connected', 'Select a connected Meta destination.', 401);
    return account;
  }

  async #validateCapability(draft, account) {
    if (account.platform === 'facebook' && draft.type === 'reel') throw new AppError('unsupported_action', 'Facebook video publishing is not enabled in this build.', 501);
    const bundle = await this.oauth.tokenBundle();
    for (const permission of required[account.platform]) if (!bundle.permissions?.includes(permission)) throw new AppError('permission_missing', `Meta permission ${permission} is not granted.`, 403);
    const page = bundle.pages.find((item) => item.id === account.pageId);
    if (!page?.tasks?.includes('CREATE_CONTENT')) throw new AppError('page_role_missing', 'This Page role does not include CREATE_CONTENT.', 403);
    if (account.platform === 'instagram' && !account.instagramUserId) throw new AppError('instagram_account_missing', 'A linked professional Instagram account is required.', 422);
    if (account.platform === 'instagram' && draft.type === 'reel' && !draft.assets.every((asset) => asset.mimeType === 'video/mp4')) throw new AppError('invalid_media', 'Instagram Reels require an MP4 video.', 422);
  }

  #assertCaptionLength(draft, platform) {
    const length = captionFor(draft).length;
    if (platform === 'instagram' && length > 2200) throw new AppError('caption_too_long', `Instagram caption is ${length} characters; the limit is 2200.`, 422);
  }

  async #saveRemoteId(id, remoteId) {
    await this.store.transaction((state) => { const attempt = state.attempts.find((row) => row.id === id); if (attempt) { attempt.remoteIds.push(remoteId); attempt.updatedAt = new Date(this.now()).toISOString(); } });
  }
  async #setStep(id, step) { await this.store.transaction((state) => { const attempt = state.attempts.find((row) => row.id === id); if (attempt) { attempt.step = step; attempt.updatedAt = new Date(this.now()).toISOString(); } }); }
  #lockKey(approval) { return [approval.target.platform, approval.target.accountId, approval.contentSha256, approval.action, approval.scheduledAt || 'now'].join(':'); }
}

function isPrivateAddress(address) {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('2001:db8:')) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0) || (a === 203 && b === 113) || a >= 224;
  }
  return false;
}
