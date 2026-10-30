import { createHash, randomUUID } from 'node:crypto';
import { AppError } from './errors.mjs';

const MAX_EVENTS = 50;
const MAX_DAYS_AHEAD = 30;
const REVIEW_FIELDS = ['title', 'starts_at', 'ends_at', 'venue', 'address', 'details', 'evidenceNotes', 'referenceUrls'];
const ISO_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

function text(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new AppError('invalid_event_draft', `${field} is required.`);
    return '';
  }
  if (typeof value !== 'string') throw new AppError('invalid_event_draft', `${field} must be text.`);
  const normalized = value.trim();
  if (normalized.includes('\u0000') || normalized.length > max || (required && !normalized)) throw new AppError('invalid_event_draft', `${field} is missing or exceeds ${max} characters.`);
  return normalized;
}

function validReferenceUrls(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new AppError('invalid_event_draft', 'Reference URLs must be an array with no more than 10 entries.');
  return value.map((entry) => {
    if (typeof entry !== 'string' || entry.length > 2048) throw new AppError('invalid_event_draft', 'Each reference must be an HTTPS URL.');
    let url;
    try { url = new URL(entry); } catch { url = null; }
    if (!url || url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new AppError('invalid_event_draft', 'Each reference must be an HTTPS URL.');
    return url.toString();
  });
}

function parseCharlotteTime(value, field, now, { required = false } = {}) {
  if (!value) {
    if (required) throw new AppError('invalid_event_date', `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new AppError('invalid_event_date', `${field} must be ISO 8601 text with an explicit offset.`);
  const match = value.match(ISO_OFFSET);
  if (!match) throw new AppError('invalid_event_date', `${field} must be ISO 8601 text with an explicit offset.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', , suffix] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const hour = Number(hourText); const minute = Number(minuteText); const second = Number(secondText);
  const daysInMonth = month === 2
    ? ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) {
    throw new AppError('invalid_event_date', `${field} is not a valid calendar time.`);
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new AppError('invalid_event_date', `${field} is invalid.`);
  const suppliedOffset = suffix === 'Z' ? '+00:00' : suffix;
  const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' }).formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value;
  if (zone?.replace('GMT', '') !== suppliedOffset) throw new AppError('invalid_event_date', `${field} offset does not match Charlotte local time for this date.`);
  const time = instant.getTime();
  if (required && (time <= now || time > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)) throw new AppError('invalid_event_date', `${field} must be upcoming within the next 30 days.`);
  return value;
}

function sourceSnapshot(candidate) {
  if (!candidate || candidate.sourcePlatform !== 'instagram' || typeof candidate.sourcePostId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(candidate.sourcePostId)) {
    throw new AppError('candidate_not_found', 'Choose a valid Instagram post candidate.', 404);
  }
  let permalink;
  try { permalink = new URL(candidate.sourcePermalink); } catch { permalink = null; }
  if (!permalink || permalink.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(permalink.hostname.toLowerCase()) || permalink.username || permalink.password || permalink.toString().length > 500) throw new AppError('candidate_invalid_source', 'The candidate has no valid Instagram source permalink.', 422);
  const handle = typeof candidate.sourceUsername === 'string' && candidate.sourceUsername
    ? `instagram:${candidate.sourceUsername}`
    : typeof candidate.sourceHashtag === 'string' && candidate.sourceHashtag
      ? `instagram:#${candidate.sourceHashtag}`
      : null;
  if (!handle || handle.length > 100) throw new AppError('candidate_source_unknown', 'The source handle could not be safely identified.', 422);
  return {
    candidateId: candidate.id,
    sourcePostId: candidate.sourcePostId,
    sourceUsername: typeof candidate.sourceUsername === 'string' ? candidate.sourceUsername : null,
    sourceHashtag: typeof candidate.sourceHashtag === 'string' ? candidate.sourceHashtag : null,
    sourcePermalink: permalink.toString(),
    sourceHandle: handle,
    caption: typeof candidate.caption === 'string' ? candidate.caption.slice(0, 4000) : '',
    postedAt: typeof candidate.postedAt === 'string' ? candidate.postedAt : null,
  };
}

function fingerprint(event) {
  const norm = (value) => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || String(value || '').trim().toLowerCase();
  const minute = Math.floor(Date.parse(event.starts_at) / 60_000);
  return createHash('sha256').update(`${norm(event.title)}|${minute}|${norm(event.venue)}`).digest('hex');
}

function validateDraft(draft, now) {
  const event = {
    title: text(draft.title, 'title', 120, { required: true }),
    starts_at: parseCharlotteTime(draft.starts_at, 'starts_at', now, { required: true }),
  };
  const endsAt = parseCharlotteTime(draft.ends_at, 'ends_at', now);
  if (endsAt && Date.parse(endsAt) <= Date.parse(event.starts_at)) throw new AppError('invalid_event_date', 'ends_at must be after starts_at.');
  if (endsAt) event.ends_at = endsAt;
  for (const [field, limit] of [['venue', 120], ['address', 200], ['details', 1000]]) {
    const value = text(draft[field], field, limit);
    if (value) event[field] = value;
  }
  if (draft.link !== draft.source.sourcePermalink || draft.source_handle !== draft.source.sourceHandle) throw new AppError('source_provenance_invalid', 'The source link and handle must match the collected Instagram post.');
  event.link = draft.source.sourcePermalink;
  event.source_handle = draft.source.sourceHandle;
  return event;
}

export class EventReviewService {
  constructor({ store, now = () => Date.now() }) { Object.assign(this, { store, now }); }

  async status() {
    const state = await this.store.read();
    const drafts = state.eventReviewDrafts || [];
    let exportableCount = 0;
    for (const draft of drafts) {
      if (draft.status === 'rejected') continue;
      try { validateDraft(draft, this.now()); exportableCount += 1; } catch { /* incomplete drafts remain editable */ }
    }
    return { enabled: true, liveWrites: false, draftsCount: drafts.length, exportableCount };
  }

  async list() {
    const state = await this.store.read();
    return [...(state.eventReviewDrafts || [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.revision - a.revision || a.id.localeCompare(b.id));
  }

  async get(id) {
    const state = await this.store.read();
    const draft = (state.eventReviewDrafts || []).find((item) => item.id === id);
    if (!draft) throw new AppError('not_found', 'Event draft not found.', 404);
    return draft;
  }

  async create(input) {
    if (typeof input?.candidateId !== 'string' || input.candidateId.length > 180) throw new AppError('invalid_request', 'Select a source post candidate.');
    const at = new Date(this.now()).toISOString();
    return this.store.transaction((state) => {
      const candidate = (state.discoveryCandidates || []).find((item) => item.id === input.candidateId);
      if (!candidate) throw new AppError('candidate_not_found', 'Source post candidate not found.', 404);
      const source = sourceSnapshot(candidate);
      const draft = {
        id: randomUUID(), candidateId: source.candidateId, source,
        title: '', starts_at: '', ends_at: '', venue: '', address: '', details: '',
        link: source.sourcePermalink, source_handle: source.sourceHandle,
        evidenceNotes: '', referenceUrls: [], status: 'draft', revision: 1, createdAt: at, updatedAt: at,
      };
      state.eventReviewDrafts ||= [];
      state.eventReviewDrafts.unshift(draft);
      state.activity.unshift({ id: randomUUID(), type: 'event_review_draft_created', at, draftId: draft.id, candidateId: draft.candidateId, sourcePostId: source.sourcePostId });
      return draft;
    });
  }

  async update(id, input) {
    if (!Number.isInteger(input?.expectedRevision)) throw new AppError('invalid_request', 'expectedRevision is required.');
    const at = new Date(this.now()).toISOString();
    return this.store.transaction((state) => {
      const draft = (state.eventReviewDrafts || []).find((item) => item.id === id);
      if (!draft) throw new AppError('not_found', 'Event draft not found.', 404);
      if (draft.revision !== input.expectedRevision) throw new AppError('revision_conflict', 'Event draft changed. Reload before editing.', 409);
      const keys = Object.keys(input).filter((key) => key !== 'expectedRevision');
      if (keys.some((key) => !REVIEW_FIELDS.includes(key))) throw new AppError('invalid_request', 'Only editable event fields and evidence notes may be changed.');
      for (const key of keys) {
        if (key === 'title') draft[key] = text(input[key], key, 120);
        else if (key === 'starts_at') draft[key] = text(input[key], key, 64);
        else if (key === 'ends_at') draft[key] = text(input[key], key, 64);
        else if (key === 'venue') draft[key] = text(input[key], key, 120);
        else if (key === 'address') draft[key] = text(input[key], key, 200);
        else if (key === 'details') draft[key] = text(input[key], key, 1000);
        else if (key === 'evidenceNotes') draft[key] = text(input[key], key, 2000);
        else if (key === 'referenceUrls') draft[key] = validReferenceUrls(input[key]);
      }
      draft.revision += 1;
      draft.status = 'draft';
      draft.updatedAt = at;
      state.activity.unshift({ id: randomUUID(), type: 'event_review_draft_updated', at, draftId: draft.id, revision: draft.revision });
      return draft;
    });
  }

  async reject(id, input) {
    if (!Number.isInteger(input?.expectedRevision)) throw new AppError('invalid_request', 'expectedRevision is required.');
    const reason = text(input.reason, 'reason', 1000, { required: true });
    const at = new Date(this.now()).toISOString();
    return this.store.transaction((state) => {
      const draft = (state.eventReviewDrafts || []).find((item) => item.id === id);
      if (!draft) throw new AppError('not_found', 'Event draft not found.', 404);
      if (draft.revision !== input.expectedRevision) throw new AppError('revision_conflict', 'Event draft changed. Reload before rejecting.', 409);
      draft.status = 'rejected';
      draft.rejection = { reason, at, revision: draft.revision };
      draft.updatedAt = at;
      state.activity.unshift({ id: randomUUID(), type: 'event_review_draft_rejected', at, draftId: draft.id, revision: draft.revision });
      return draft;
    });
  }

  async export() {
    const drafts = await this.list();
    const events = [];
    const fingerprints = new Set();
    for (const draft of drafts) {
      if (draft.status === 'rejected') continue;
      let event;
      try { event = validateDraft(draft, this.now()); } catch { continue; }
      const key = fingerprint(event);
      if (fingerprints.has(key)) continue;
      fingerprints.add(key);
      events.push(event);
      if (events.length > MAX_EVENTS) throw new AppError('too_many_events', `Export at most ${MAX_EVENTS} events per file.`, 422);
    }
    if (Buffer.byteLength(JSON.stringify({ events }), 'utf8') > 256 * 1024) throw new AppError('export_too_large', 'The events.json export exceeds the inbox 256 KiB limit.', 422);
    return { events };
  }
}
