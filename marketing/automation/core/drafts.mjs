import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { contentDigest, sha256 } from './canonical.mjs';
import { AppError } from './errors.mjs';

function mimeFromBytes(bytes, name) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') return name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  return 'application/octet-stream';
}

function editableDraft(item, type, revision = 1, assetRefs = []) {
  return {
    id: item.id,
    type,
    title: item.title,
    format: item.format,
    slides: item.slides ?? [],
    caption: item.caption ?? '',
    hashtags: item.hashtags ?? [],
    cta: item.cta ?? '',
    platforms: item.platforms ?? [],
    status: 'draft',
    pinnedCandidate: item.pinnedCandidate === true,
    durationSeconds: item.durationSeconds ?? null,
    timestampedScript: item.timestampedScript ?? [],
    shotList: item.shotList ?? [],
    mediaPurpose: type === 'reel' ? 'concept_storyboard' : 'rendered_carousel_art',
    mediaDisclosure: type === 'reel' ? 'Concept storyboard · typography only; silent, with no recorded footage or voiceover.' : '',
    revision,
    assetRefs,
    assetFingerprint: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export class DraftService {
  constructor({ store, contentPath, mediaDir, jpegMediaDir = mediaDir, reelsDir }) {
    this.store = store;
    this.contentPath = contentPath;
    this.mediaDir = mediaDir;
    this.jpegMediaDir = jpegMediaDir;
    this.reelsDir = reelsDir;
  }

  async initialize() {
    const source = JSON.parse(await readFile(this.contentPath, 'utf8'));
    const sourceItems = [
      ...(source.posts || []).map((item) => ({ item, type: 'feed' })),
      ...(source.reels || []).map((item) => ({ item, type: 'reel' })),
    ];
    const seeded = [];
    for (const { item, type } of sourceItems) {
      const assetRefs = type === 'feed'
        ? (item.slides || []).map((_slide, index) => ({ index, name: `${item.id}-${String(index + 1).padStart(2, '0')}.jpg`, root: 'jpeg' }))
        : [{ index: 0, name: `${item.id}.mp4`, root: 'reels' }];
      const draft = editableDraft(item, type, 1, assetRefs);
      const assets = await this.#readAssets(draft);
      draft.assetFingerprint = this.#assetFingerprint(assets);
      seeded.push(draft);
    }
    await this.store.transaction((state) => {
      if (Object.keys(state.drafts).length > 0) return false;
      for (const draft of seeded) state.drafts[draft.id] = draft;
      this.#event(state, 'drafts_seeded', { count: seeded.length });
      return true;
    });
  }

  async list() {
    await this.#refreshAssetFingerprints();
    const state = await this.store.read();
    const drafts = await Promise.all(Object.values(state.drafts).map((draft) => this.#materialize(draft)));
    return drafts;
  }

  async calendar() {
    const source = JSON.parse(await readFile(this.contentPath, 'utf8'));
    return Array.isArray(source.calendar) ? source.calendar : [];
  }

  async get(id) {
    await this.#refreshAssetFingerprints();
    const state = await this.store.read();
    const draft = state.drafts[id];
    if (!draft) throw new AppError('not_found', 'Draft not found.', 404);
    return this.#materialize(draft);
  }

  async update(id, input) {
    const current = await this.get(id);
    this.#checkRevision(current, input);
    const allowed = new Set(['expectedRevision', 'expectedContentSha256', 'title', 'caption', 'cta', 'hashtags']);
    if (current.type === 'reel' && ('timestampedScript' in input || 'shotList' in input)) throw new AppError('media_sync_required', 'Reel script and shot-list edits need matching MP4 and subtitle renders; these fields are read-only here.', 409);
    for (const key of Object.keys(input)) if (!allowed.has(key)) throw new AppError('invalid_request', `Field ${key} cannot be edited.`);
    if ('title' in input) this.#assertText(input.title, 140, 'title');
    if ('caption' in input) this.#assertText(input.caption, 5000, 'caption');
    if ('cta' in input) this.#assertText(input.cta, 500, 'cta');
    if ('hashtags' in input && (!Array.isArray(input.hashtags) || input.hashtags.length > 30 || input.hashtags.some((tag) => typeof tag !== 'string' || tag.length > 100))) {
      throw new AppError('invalid_request', 'Hashtags must be a list of at most 30 short strings.');
    }
    const changed = Object.keys(input).some((key) => !['expectedRevision', 'expectedContentSha256'].includes(key));
    if (!changed) return current;

    await this.store.transaction((state) => {
      const draft = state.drafts[id];
      if (!draft || draft.revision !== input.expectedRevision) throw new AppError('revision_conflict', 'Draft changed. Reload before editing.', 409);
      Object.assign(draft, Object.fromEntries(Object.entries(input).filter(([key]) => !['expectedRevision', 'expectedContentSha256'].includes(key))));
      draft.revision += 1;
      draft.updatedAt = new Date().toISOString();
      this.#event(state, 'draft_edited', { draftId: id, revision: draft.revision, contentSha256: current.contentSha256 });
      this.#invalidateDraftApprovals(state, id);
    });
    return this.get(id);
  }

  async assetsFor(id) {
    const draft = await this.get(id);
    if (draft.assets.some((asset) => !asset.available)) throw new AppError('asset_missing', 'Every slide needs its rendered media asset.', 422);
    if (draft.type === 'reel' && (draft.assets.length !== 1 || draft.assets[0].mimeType !== 'video/mp4')) throw new AppError('asset_missing', 'Reel needs one rendered MP4 video.', 422);
    return draft.assets;
  }

  async readPublicMedia(name) {
    if (typeof name !== 'string' || basename(name) !== name || !/^[A-Za-z0-9._-]{1,160}$/.test(name)) throw new AppError('not_found', 'Media not found.', 404);
    const state = await this.store.read();
    const ref = Object.values(state.drafts).flatMap((draft) => draft.assetRefs).find((asset) => asset.name === name);
    if (!ref) throw new AppError('not_found', 'Media not found.', 404);
    return readFile(this.#assetPath(ref));
  }

  async recordDecision(id, input) {
    const draft = await this.get(id);
    if (input.revision !== draft.revision || input.contentSha256 !== draft.contentSha256) throw new AppError('revision_conflict', 'Draft changed. Reload before recording a decision.', 409);
    if (!['reject', 'request_changes'].includes(input.decision)) throw new AppError('invalid_request', 'Decision must be reject or request_changes.');
    if (typeof input.note !== 'string' || input.note.trim().length < 1 || input.note.length > 2000) throw new AppError('invalid_request', 'Add a short decision note.');
    if (typeof input.reviewer !== 'string' || input.reviewer.trim().length < 1 || input.reviewer.length > 120) throw new AppError('invalid_request', 'Reviewer identity is required.');
    const record = {
      id: randomUUID(), draftId: id, revision: draft.revision, contentSha256: draft.contentSha256,
      decision: input.decision, note: input.note.trim(), reviewer: input.reviewer.trim(), at: new Date().toISOString(),
      contentSnapshot: {
        title: draft.title, format: draft.format, caption: draft.caption, hashtags: draft.hashtags, cta: draft.cta,
        platforms: draft.platforms, slides: draft.slides.map(({ headline, body }) => ({ headline, body })),
        timestampedScript: draft.timestampedScript, shotList: draft.shotList,
        assets: draft.assets.map(({ name, sha256, mimeType, index }) => ({ name, sha256, mimeType, index })),
      },
    };
    await this.store.transaction((state) => {
      state.decisions.unshift(record);
      this.#event(state, `draft_${input.decision}`, { draftId: id, revision: draft.revision, decisionId: record.id });
    });
    return record;
  }

  async #refreshAssetFingerprints() {
    const state = await this.store.read();
    const changed = [];
    for (const draft of Object.values(state.drafts)) {
      const assets = await this.#readAssets(draft);
      const fingerprint = this.#assetFingerprint(assets);
      if (fingerprint !== draft.assetFingerprint) changed.push({ id: draft.id, fingerprint });
    }
    if (!changed.length) return;
    await this.store.transaction((next) => {
      for (const entry of changed) {
        const draft = next.drafts[entry.id];
        if (draft && draft.assetFingerprint !== entry.fingerprint) {
          draft.assetFingerprint = entry.fingerprint;
          draft.revision += 1;
          draft.updatedAt = new Date().toISOString();
          this.#event(next, 'draft_media_changed', { draftId: entry.id, revision: draft.revision });
          this.#invalidateDraftApprovals(next, entry.id);
        }
      }
    });
  }

  async #materialize(draft) {
    const assets = await this.#readAssets(draft);
    const digest = contentDigest(draft, assets);
    return {
      ...draft,
      slides: draft.slides.map((slide, index) => ({ ...slide, asset: assets[index] ? { path: assets[index].url, sha256: assets[index].sha256, mimeType: assets[index].mimeType, available: assets[index].available } : null })),
      assets: assets.map(({ bytes, ...asset }) => asset),
      contentSha256: digest,
      mediaReady: assets.length > 0 && assets.every((asset) => asset.available),
    };
  }

  async #readAssets(draft) {
    const assets = [];
    for (const ref of draft.assetRefs) {
      try {
        const bytes = await readFile(this.#assetPath(ref));
        assets.push({
          index: ref.index,
          name: ref.name,
          sha256: sha256(bytes),
          mimeType: mimeFromBytes(bytes, ref.name),
          url: `/media/${encodeURIComponent(ref.name)}`,
          available: true,
          bytes,
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        assets.push({ index: ref.index, name: ref.name, sha256: '', mimeType: '', url: '', available: false });
      }
    }
    return assets;
  }

  #assetFingerprint(assets) {
    return sha256(JSON.stringify(assets.map(({ index, name, sha256: digest, mimeType, available }) => ({ index, name, sha256: digest, mimeType, available }))));
  }

  #assetPath(ref) {
    const root = ref.root === 'jpeg' ? this.jpegMediaDir : ref.root === 'reels' ? this.reelsDir : this.mediaDir;
    const base = resolve(root);
    const path = resolve(base, ref.name);
    if (!path.startsWith(`${base}\\`) && !path.startsWith(`${base}/`)) throw new AppError('asset_path_invalid', 'The registered asset path is invalid.', 500);
    return path;
  }

  #checkRevision(current, input) {
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== current.revision || input.expectedContentSha256 !== current.contentSha256) {
      throw new AppError('revision_conflict', 'Draft changed. Reload before editing.', 409);
    }
  }

  #assertText(value, max, field) {
    if (typeof value !== 'string' || value.length > max) throw new AppError('invalid_request', `${field} must be text under ${max} characters.`);
  }

  #invalidateDraftApprovals(state, id) {
    for (const approval of state.approvals) {
      if (approval.draftId === id && approval.status === 'approved') approval.status = 'invalidated';
    }
  }

  #event(state, type, details) {
    state.activity.unshift({ id: randomUUID(), type, at: new Date().toISOString(), ...details });
    state.activity = state.activity.slice(0, 5000);
  }
}
