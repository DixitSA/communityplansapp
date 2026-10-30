import { createHash } from 'node:crypto';

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function contentDigest(draft, assets) {
  const data = {
    id: draft.id,
    type: draft.type,
    title: draft.title,
    format: draft.format,
    caption: draft.caption ?? '',
    cta: draft.cta ?? '',
    hashtags: draft.hashtags ?? [],
    slides: draft.slides ?? [],
    timestampedScript: draft.timestampedScript ?? [],
    shotList: draft.shotList ?? [],
    durationSeconds: draft.durationSeconds ?? null,
    platforms: draft.platforms ?? [],
    assets: assets.map(({ name, sha256: digest, mimeType, index }) => ({ name, sha256: digest, mimeType, index })),
  };
  return sha256(canonicalJson(data));
}
