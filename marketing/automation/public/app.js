(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const shortHash = value => value ? `${String(value).slice(0, 12)}…` : 'hash unavailable';
  const fmtDate = value => {
    if (!value) return 'Time not set';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const datetimeInputValue = value => typeof value === 'string' ? value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)?.[1] || '' : '';
  const datetimeOffset = value => typeof value === 'string' ? value.match(/([+-]\d{2}:\d{2})$/)?.[1] || '' : '';
  const withExplicitOffset = (local, offset) => {
    if (!local) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !/^[-+]\d{2}:\d{2}$/.test(offset)) return null;
    return `${local}:00${offset}`;
  };
  const mediaUrl = path => {
    if (!path || typeof path !== 'string') return '';
    const filename = path.split(/[\\/]/).filter(Boolean).pop();
    return filename ? `/media/${encodeURIComponent(filename)}` : '';
  };
  const errorMessage = body => body?.error?.message || body?.message || body?.error?.code || 'The local service could not complete this request.';
  const httpsUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const instagramMediaUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname.toLowerCase().endsWith('.cdninstagram.com') || url.hostname.toLowerCase().endsWith('.fbcdn.net')) ? url.href : ''; } catch { return ''; } };

  const state = {
    view: 'overview', drafts: [], draftDetails: new Map(), selectedId: null,
    status: null, accounts: [], approvals: [], activity: [], provider: null, calendar: [],
    insights: null, insightsError: null, apiError: '', listFilter: 'all', detailTab: 'media',
    decisionNote: '', busy: false, discoveryCandidates: [], discoveryError: '',
    discoveryMessage: '', discoveryBusy: false, discoveryLastCollection: null, discoveryUsername: '',
    discoveryLeads: [], discoveryLeadsError: '', followingImportResult: null, followingImportBusy: false,
    hashtagQuota: null, hashtagQuotaError: '', hashtagCollectBusy: false, hashtagLastCollection: null,
    discoveryHashtag: '', hashtagError: '', eventDrafts: [], selectedEventDraftId: '',
    eventDraftError: '', eventDraftBusy: false, eventReviewResult: '', eventDraftDirty: false,
    eventReviewStatus: null, eventReviewStatusError: ''
  };

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      cache: 'no-store'
    });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const error = new Error(errorMessage(body));
      error.status = response.status;
      error.code = body?.error?.code || 'http_error';
      error.body = body;
      throw error;
    }
    return body || {};
  }

  async function fetchOptional(path, key) {
    try { return { data: await request(path), error: null }; }
    catch (error) { return { data: null, error: `${key}: ${errorMessage(error)}`, status: error.status, code: error.code }; }
  }

  async function refreshAll({ quiet = false } = {}) {
    if (!quiet) setApiState('syncing', 'Refreshing…');
    const [status, drafts, accounts, approvals, activity, provider, calendar, discovery, leads, quota, eventReview, eventReviewStatus] = await Promise.all([
      fetchOptional('/api/status', 'Status'), fetchOptional('/api/drafts', 'Drafts'),
      fetchOptional('/api/accounts', 'Accounts'), fetchOptional('/api/approvals', 'Approvals'),
      fetchOptional('/api/activity', 'Activity'), fetchOptional('/api/provider', 'Provider'), fetchOptional('/api/calendar', 'Calendar'),
      fetchOptional('/api/discovery/candidates', 'Event discovery'), fetchOptional('/api/discovery/leads', 'Source leads'),
      fetchOptional('/api/discovery/quota', 'Hashtag quota'), fetchOptional('/api/event-review/drafts', 'Event drafts'),
      fetchOptional('/api/event-review/status', 'Event review')
    ]);
    state.status = status.data?.status || status.data?.server ? (status.data.status || status.data) : null;
    state.drafts = Array.isArray(drafts.data?.drafts) ? drafts.data.drafts : [];
    state.accounts = Array.isArray(accounts.data?.accounts) ? accounts.data.accounts : [];
    state.approvals = Array.isArray(approvals.data?.approvals) ? approvals.data.approvals : [];
    state.activity = Array.isArray(activity.data?.items) ? activity.data.items : [];
    state.provider = provider.data?.provider ? provider.data : null;
    state.calendar = Array.isArray(calendar.data?.calendar) ? calendar.data.calendar : [];
    state.discoveryCandidates = Array.isArray(discovery.data?.candidates) ? discovery.data.candidates : [];
    state.discoveryError = discovery.error || '';
    state.discoveryLeads = Array.isArray(leads.data?.leads) ? leads.data.leads : [];
    state.discoveryLeadsError = leads.error || '';
    state.hashtagQuota = quota.data?.quota || null;
    state.hashtagQuotaError = quota.error || '';
    state.eventDrafts = Array.isArray(eventReview.data?.drafts) ? eventReview.data.drafts : [];
    state.eventReviewStatus = eventReviewStatus.data || null;
    state.eventReviewStatusError = eventReviewStatus.error || '';
    state.apiError = drafts.error || status.error || '';
    if (!state.selectedId && state.drafts.length) state.selectedId = state.drafts[0].id;
    if (state.selectedId && !state.drafts.some(item => item.id === state.selectedId)) state.selectedId = state.drafts[0]?.id || null;
    if (state.selectedId && !state.draftDetails.has(state.selectedId)) await loadDraft(state.selectedId, { quiet: true });
    const errors = [status, drafts, accounts, approvals, activity, provider, calendar].filter(item => item.error);
    setApiState(errors.length ? 'partial' : 'connected', errors.length ? 'Some data unavailable' : 'Local service connected');
    updatePublishState();
    renderAll();
  }

  async function loadDraft(id, { quiet = false } = {}) {
    if (!id) return null;
    try {
      const result = await request(`/api/drafts/${encodeURIComponent(id)}`);
      const draft = result.draft || result;
      state.draftDetails.set(id, draft);
      return draft;
    } catch (error) {
      const fallback = state.drafts.find(item => item.id === id) || null;
      if (fallback) state.draftDetails.set(id, fallback);
      if (!quiet) toast(`Could not load full draft: ${errorMessage(error)}`, true);
      return fallback;
    }
  }

  function currentDraft() {
    return state.draftDetails.get(state.selectedId) || state.drafts.find(item => item.id === state.selectedId) || null;
  }

  function setApiState(kind, label) {
    const node = $('#api-state');
    if (!node) return;
    const dotClass = kind === 'connected' ? '' : kind === 'syncing' ? '' : 'off';
    node.innerHTML = `<i class="status-dot ${dotClass}"></i>${esc(label)}`;
  }

  function updatePublishState() {
    const configured = typeof state.status?.publishingEnabled === 'boolean';
    const enabled = Boolean(state.status?.publishingEnabled);
    const label = !configured ? 'SERVER FLAG · UNKNOWN' : enabled ? 'SERVER FLAG · ENABLED' : 'SERVER FLAG · DISABLED';
    $('#publish-state').textContent = label;
    $('#publish-banner-title').textContent = !configured ? 'Server publishing state unavailable' : enabled ? 'Publishing is enabled for explicit actions' : 'Publishing is disabled by the server';
    $('#publish-banner-copy').textContent = !configured
      ? 'No post action is available until the local service reports its publishing state. Every execution needs a prior exact approval and a separate human confirmation.'
      : enabled
        ? 'A publish-now action appears only for an existing approved revision and requires another human confirmation. Scheduled approvals run at their exact approved time; revoke before execution.'
        : 'Drafts and approval records do not publish. Execution and scheduled delivery are paused by YARD_META_PUBLISH_ENABLED=false.';
    $('#sidebar-publish-label').textContent = configured ? `Server publish flag · ${enabled ? 'enabled' : 'disabled'}` : 'Server publish flag · unknown';
    const dot = $('#sidebar-publish-dot');
    if (dot) { dot.classList.toggle('off', !configured || !enabled); dot.classList.toggle('bad', enabled); }
  }

  function toast(message, error = false) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.toggle('error', error);
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 5200);
  }

  function showView(view) {
    state.view = view;
    $$('.nav-item[data-view]').forEach(node => node.classList.toggle('active', node.dataset.view === view));
    $$('.view').forEach(node => {
      const active = node.id === `view-${view}`;
      node.classList.toggle('active', active);
      node.hidden = !active;
    });
    const nav = $(`.nav-item[data-view="${view}"]`);
    $('#crumb-current').textContent = nav?.textContent?.trim().replace(/\s+\d+$/, '') || 'Overview';
    $('.sidebar').classList.remove('open');
    renderView(view);
  }

  function getKind(draft) {
    return draft?.format || (draft?.timestampedScript?.length ? 'reel' : 'carousel');
  }
  function isReel(draft) { return getKind(draft).toLowerCase().includes('reel'); }
  function reelAsset(draft) { return Array.isArray(draft?.assets) ? draft.assets.find(asset => asset.mimeType?.startsWith('video/')) || null : null; }
  function slideAsset(draft, index, slide) { return slide?.asset || draft?.assets?.find(asset => asset.index === index) || null; }
  function assetUrl(asset) { return asset?.url || mediaUrl(asset?.path || asset?.name); }
  function draftById(id) { return state.draftDetails.get(id) || state.drafts.find(item => item.id === id) || null; }
  function statusBadge(status) {
    const cls = /reject|fail|error|unknown/i.test(status || '') ? 'failed' : /pending|scheduled/i.test(status || '') ? 'pending' : /revok/i.test(status || '') ? 'revoked' : '';
    return `<span class="status-tag ${cls}">${esc(status || 'draft')}</span>`;
  }
  function draftThumb(draft) {
    const cover = draft?.slides?.[0]?.asset?.path
      ? { url: mediaUrl(draft.slides[0].asset.path) }
      : (draft?.assets || []).find(asset => asset.mimeType?.startsWith('image/'));
    const url = cover?.url || mediaUrl(cover?.path || cover?.name);
    return url ? `<img class="queue-thumb" src="${esc(url)}" alt="" loading="lazy">` : `<span class="queue-thumb reel-thumb" aria-hidden="true">${isReel(draft) ? 'REEL' : ''}</span>`;
  }
  function draftName(id) { return draftById(id)?.title || id || 'Untitled draft'; }
  function approvalCanBeReviewed(draft) {
    if (!draft) return { ok: false, note: 'Draft data is unavailable.' };
    if (isReel(draft)) {
      const asset = reelAsset(draft);
      if (draft.mediaReady !== true || !asset?.available || !asset.sha256 || !assetUrl(asset)) return { ok: false, note: 'A registered, verified reel video asset is required before approval.' };
    }
    const slides = draft.slides || [];
    const assets = slides.map((slide, index) => slideAsset(draft, index, slide));
    if (!isReel(draft) && (!slides.length || assets.some(asset => !asset?.available || !asset?.sha256 || !assetUrl(asset)))) return { ok: false, note: 'Final slide media or its verified hash is missing.' };
    const platforms = draft.platforms || [];
    const connected = state.accounts.some(account => account.connected && platforms.includes(account.platform));
    if (!connected) return { ok: false, note: 'Connect a real account for one of this draft’s platforms before recording approval.' };
    return { ok: true, note: state.status?.publishingEnabled ? 'Approval records intent only; publishing requires a separate explicit action.' : 'Approval can be recorded locally. Publishing and external scheduling stay disabled until the server flag is explicitly enabled.' };
  }

  function renderAll() {
    $('#nav-draft-count').textContent = state.drafts.length || '0';
    ['overview', 'drafts', 'calendar', 'discovery', 'history', 'insights', 'ideas'].forEach(renderView);
    showView(state.view);
  }

  function renderView(view) {
    const renderer = {
      overview: renderOverview, drafts: renderDrafts, calendar: renderCalendar,
      discovery: renderDiscovery, history: renderHistory, insights: renderInsights, ideas: renderIdeas
    }[view];
    if (renderer) renderer();
  }

  function pageHeading(kicker, title, subtitle, actions = '') {
    return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
  }

  function renderAccountControl() {
    const connected = state.accounts.filter(account => account.connected);
    const accountList = connected.map(account => `<div class="connected-account"><span class="status-dot"></span><span><b>${esc(account.name)}</b><small>${esc(account.platform)}${account.accountType ? ` · ${esc(account.accountType)}` : ''}</small></span></div>`).join('');
    const action = connected.length
      ? '<button class="button danger small" data-disconnect-meta>Disconnect Meta</button>'
      : state.status?.oauthReady
        ? '<button class="button secondary small" data-connect-meta>Connect Meta account →</button>'
        : '<button class="button secondary small" disabled title="Configure OAuth in the local server environment first">Meta connection not configured</button>';
    const note = connected.length
      ? 'Disconnect clears the encrypted local token and account links. It does not delete the Meta Page or account.'
      : state.status?.oauthReady
        ? 'Connect only when you choose to. OAuth opens in this browser and returns to the local dashboard.'
        : 'OAuth is not configured on the local server. Configure its Meta app and callback first; no token entry is accepted here.';
    return `<div class="account-control"><div class="account-control-head"><div><div class="eyebrow">META CONNECTION</div><b>${connected.length ? 'Connected accounts' : 'No account connected'}</b></div><span class="connection-chip ${connected.length ? 'is-connected' : ''}">${connected.length ? `${connected.length} linked` : state.status?.oauthReady ? 'ready to connect' : 'not configured'}</span></div>${connected.length ? `<div class="connected-list">${accountList}</div>` : ''}<p>${esc(note)}</p><div class="account-control-actions">${action}</div></div>`;
  }

  function renderOverview() {
    const host = $('#view-overview');
    if (!host) return;
    const needsReview = state.drafts.filter(draft => !['approved', 'scheduled', 'published'].includes((draft.status || 'draft').toLowerCase())).length;
    const pending = state.approvals.filter(item => ['approved', 'scheduled', 'pending'].includes((item.status || '').toLowerCase())).length;
    const feed = state.drafts.filter(item => !isReel(item)).length;
    const reels = state.drafts.length - feed;
    const queue = state.drafts.slice(0, 5).map(draft => `<button class="queue-row" data-open-draft="${esc(draft.id)}">${draftThumb(draft)}<span class="queue-copy"><h3>${esc(draft.title)}</h3><p>${esc(getKind(draft))} · revision ${esc(draft.revision ?? '—')} · ${esc(draft.platforms?.join(' + ') || 'platforms not set')}</p></span><span class="queue-end">${statusBadge(draft.status)}<span class="arrow">→</span></span></button>`).join('');
    const checks = [
      ['Meta account', state.accounts.some(item => item.connected) ? 'A connected account is available for review.' : 'No account is connected. Approvals require a real platform destination.'],
      ['Publishing switch', state.status?.publishingEnabled ? 'Enabled; an existing approved publish-now record still needs a second human confirmation.' : 'Off by default. Delivery and scheduled execution are paused.'],
      ['Idea provider', state.provider?.enabled ? `${state.provider.provider} · ${state.provider.model || 'model not reported'} is configured.` : 'No provider/model configured. Regeneration is unavailable.']
    ].map(([label, note]) => `<div class="check-row"><i class="status-dot ${label === 'Meta account' && !state.accounts.some(item => item.connected) ? 'off' : ''}"></i><div><b>${esc(label)}</b><p>${esc(note)}</p></div></div>`).join('');
    const peek = (state.drafts.length ? state.drafts.slice(0, 3).map((draft, index) => `<div class="peek-row"><span class="peek-day">Draft<br>${String(index + 1).padStart(2, '0')}</span><span><b>${esc(draft.title)}</b><span>${esc(getKind(draft))} · relative calendar only</span></span></div>`) : `<div class="empty-state"><h3>No content loaded</h3><p>Start the local server to load the campaign drafts.</p></div>`).join('');
    host.innerHTML = `${pageHeading('YARD · LOCAL MARKETING', 'Good plans start here.', 'Review the Charlotte launch campaign, shape copy, and capture clear human decisions.')}
      <section class="overview-hero"><div><div class="eyebrow">CAMPAIGN ROOM · CHARLOTTE FIRST</div><h2>A little less “what should we do?”</h2><p>Build useful, low-pressure social content around the small step between an idea and a plan. Everything below is a draft until a person reviews it.</p></div><div class="hero-side"><strong>${feed} + ${reels}</strong><span>feed and Reel drafts in the current campaign</span></div></section>
      <div class="stats-row"><div class="stat-cell"><strong>${state.drafts.length}</strong><span>Current drafts</span></div><div class="stat-cell"><strong>${needsReview}</strong><span>Need a decision</span></div><div class="stat-cell"><strong>${pending}</strong><span>Approval records</span></div><div class="stat-cell"><strong>${state.accounts.filter(item => item.connected).length}</strong><span>Connected accounts</span></div></div>
      <div class="overview-grid"><div><div class="section-title"><div><div class="eyebrow">THE QUEUE</div><h2>Drafts to look over</h2></div><button class="text-link" data-view="drafts">All drafts →</button></div><div class="queue-list">${queue || `<div class="empty-state"><h3>Drafts will appear here</h3><p>When the local API is available, this view loads the campaign from the server.</p></div>`}</div></div>
      <div class="side-stack"><section class="surface-section"><div class="eyebrow">CONNECTION CHECK</div><h3>Before anything can move</h3>${checks}${renderAccountControl()}</section><section class="surface-section"><div class="section-title"><div><div class="eyebrow">CONTENT PLAN</div><h2>On the board</h2></div><button class="text-link" data-view="calendar">30 days →</button></div><div class="calendar-peek">${peek}</div></section></div></div>`;
  }

  function filteredDrafts() {
    if (state.listFilter === 'feed') return state.drafts.filter(item => !isReel(item));
    if (state.listFilter === 'reel') return state.drafts.filter(isReel);
    if (state.listFilter === 'approved') return state.drafts.filter(item => ['approved', 'scheduled', 'published'].includes((item.status || '').toLowerCase()));
    return state.drafts;
  }

  function renderDrafts() {
    const host = $('#view-drafts');
    if (!host) return;
    const draft = currentDraft();
    const buttons = `<button class="button secondary" data-view="ideas">✳ Regenerate</button>`;
    const list = filteredDrafts().map(item => `<button class="draft-list-item ${item.id === state.selectedId ? 'selected' : ''}" data-select-draft="${esc(item.id)}">${draftThumb(item)}<span><h3>${esc(item.title)}</h3><p>${esc(getKind(item))} · r${esc(item.revision ?? '—')} · ${esc(item.status || 'draft')}</p></span></button>`).join('');
    const filters = `<div class="filters"><button class="filter-button ${state.listFilter === 'all' ? 'active' : ''}" data-filter="all">All ${state.drafts.length}</button><button class="filter-button ${state.listFilter === 'feed' ? 'active' : ''}" data-filter="feed">Feed ${state.drafts.filter(d => !isReel(d)).length}</button><button class="filter-button ${state.listFilter === 'reel' ? 'active' : ''}" data-filter="reel">Reels ${state.drafts.filter(isReel).length}</button><button class="filter-button ${state.listFilter === 'approved' ? 'active' : ''}" data-filter="approved">Approved ${state.drafts.filter(d => d.status === 'approved').length}</button></div>`;
    host.innerHTML = `${pageHeading('EDITORIAL WORKSPACE', 'Drafts', 'Edit copy, inspect the actual media, and record a decision against an exact revision.', buttons)}${filters}<div class="draft-layout"><div class="draft-list">${list || `<div class="empty-state"><h3>No drafts in this view</h3><p>Try another filter or refresh from the local service.</p></div>`}</div><div id="draft-detail-slot">${draft ? renderDraftDetail(draft) : `<div class="empty-state"><h3>Select a draft</h3><p>Choose a draft to view its media and complete copy.</p></div>`}</div></div>`;
    bindDetailEvents();
  }

  function renderDraftDetail(draft) {
    const isReelDraft = isReel(draft);
    const canReview = approvalCanBeReviewed(draft);
    const title = draft.title || draft.id;
    const tabs = `<div class="detail-tabs"><button class="detail-tab ${state.detailTab === 'media' ? 'active' : ''}" data-detail-tab="media">${isReelDraft ? 'Script & shot list' : 'Media & copy'}</button><button class="detail-tab ${state.detailTab === 'edit' ? 'active' : ''}" data-detail-tab="edit">Edit draft</button><button class="detail-tab ${state.detailTab === 'review' ? 'active' : ''}" data-detail-tab="review">Review & decide</button></div>`;
    return `<article class="draft-detail"><header class="detail-top"><div><div class="tagrow"><span class="tag">${esc(draft.status || 'draft')}</span><span class="tag muted">${esc(getKind(draft))}</span>${draft.pinnedCandidate ? '<span class="tag muted">Pin candidate</span>' : ''}</div><h2>${esc(title)}</h2><p>${esc(draft.platforms?.join(' · ') || 'Platforms not selected')} · ${esc(draft.location || 'Charlotte first')}</p></div><span class="revision-chip">r${esc(draft.revision ?? '—')}</span></header>${tabs}<div class="detail-body">${state.detailTab === 'edit' ? renderEditor(draft) : state.detailTab === 'review' ? renderReview(draft, canReview) : renderMediaAndCopy(draft)}</div></article>`;
  }

  function renderMediaAndCopy(draft) {
    if (isReel(draft)) {
      const video = reelAsset(draft);
      const script = (draft.timestampedScript || []).map(item => `<div class="script-line"><span class="script-time">${esc(item.time)}</span><div><b>Voiceover</b><p>${esc(item.voiceover)}</p><b>On screen</b><p>${esc(item.onScreen)}</p></div></div>`).join('');
      const shots = (draft.shotList || []).map(item => `<li><b>${esc(item.time)}</b> · ${esc(item.shot)}</li>`).join('');
      const videoPreview = video?.available && assetUrl(video) ? `<div class="video-frame"><video controls preload="metadata" src="${esc(assetUrl(video))}" aria-label="${esc(draft.title)} concept storyboard"></video><div class="media-warning"><b>${esc(draft.mediaDisclosure || 'Concept storyboard')}</b><br>${esc(video.name || video.filename || '')} · ${esc(draft.mediaPurpose || 'draft media')}</div></div>` : `<div class="media-warning">No verified video media is attached yet. This script cannot be approved.</div>`;
      return `${videoPreview}<div class="eyebrow stacked-eyebrow">TIMED SCRIPT</div>${script || '<p class="action-note">No script rows available.</p>'}<div class="eyebrow stacked-eyebrow">SHOT LIST</div><ul class="list-bullets">${shots || '<li>No shot list available.</li>'}</ul>${renderCopyBlock(draft)}`;
    }
    const slides = (draft.slides || []).map((slide, index) => {
      const asset = slideAsset(draft, index, slide);
      const url = assetUrl(asset);
      return `<figure class="media-slide">${asset?.available && url ? `<img src="${esc(url)}" alt="Slide ${index + 1}: ${esc(slide.headline)}" loading="lazy">` : `<div class="missing-media">Slide ${index + 1}<br>Asset missing</div>`}<figcaption>${String(index + 1).padStart(2, '0')} / ${String(draft.slides.length).padStart(2, '0')} · ${esc(slide.headline)}</figcaption></figure>`;
    }).join('');
    const hash = (draft.slides || []).map((slide, index) => `<div class="hashline"><b>Slide ${index + 1} asset:</b> ${esc(slideAsset(draft, index, slide)?.sha256 || 'No verified hash')}</div>`).join('');
    return `<div class="eyebrow">FINAL MEDIA PREVIEW · ${esc(draft.slides?.length || 0)} SLIDES</div><div class="media-strip">${slides || '<div class="missing-media">No rendered media attached</div>'}</div>${renderCopyBlock(draft)}<div class="hashline"><b>Revision hash:</b> ${esc(draft.contentSha256 || 'unavailable')}</div>${hash}<p class="action-note">Slide artwork and its headline/body are reviewed together. Editing slide text needs a new matching render; this editor keeps slide creative read-only.</p>`;
  }

  function renderCopyBlock(draft) {
    const hashtags = (draft.hashtags || []).map(tag => esc(tag)).join(' ');
    return `<div class="copyblock"><h4>Full caption</h4><p>${esc(draft.caption || 'No caption supplied.')}</p><h4>Hashtags</h4><div class="hashtags">${hashtags || 'None supplied'}</div><h4>Call to action</h4><p>${esc(draft.cta || 'No CTA supplied.')}</p></div>`;
  }

  function renderEditor(draft) {
    const isReelDraft = isReel(draft);
    const hashtagText = (draft.hashtags || []).join('\n');
    const scriptFields = isReelDraft ? (draft.timestampedScript || []).map(line => `<div class="slide-editor"><div class="editor-grid"><div class="field"><span>Timecode</span><div class="readonly-copy">${esc(line.time)}</div></div><div class="field"><span>Voiceover · ${esc(line.time)}</span><div class="readonly-copy">${esc(line.voiceover)}</div></div><div class="field"><span>On-screen text · ${esc(line.time)}</span><div class="readonly-copy">${esc(line.onScreen)}</div></div></div></div>`).join('') : '';
    const shots = isReelDraft ? (draft.shotList || []).map(line => `<div class="field"><span>Shot · ${esc(line.time)}</span><div class="readonly-copy">${esc(line.shot)}</div></div>`).join('') : '';
    const slidesReadOnly = !isReelDraft ? `<div class="media-warning">Slide headlines and body copy are read-only until the matching JPEG artwork can be rerendered. The images below are the exact final-media source for review.</div><div class="media-strip">${(draft.slides || []).map((slide, i) => `<figure class="media-slide"><img src="${esc(assetUrl(slideAsset(draft, i, slide)))}" alt="Slide ${i + 1}: ${esc(slide.headline)}"><figcaption>${String(i + 1).padStart(2, '0')} · ${esc(slide.headline)}<br>${esc(slide.body)}</figcaption></figure>`).join('')}</div>` : '';
    const hash = `<div class="hashline"><b>Current r${esc(draft.revision)} hash:</b> ${esc(draft.contentSha256 || 'unavailable')}</div>`;
    const mediaSyncNote = isReelDraft ? '<div class="media-warning">Timed script and shot list are read-only because changing them would leave the approved video and subtitles out of sync. You can edit the caption, hashtags, and call to action; matching MP4/SRT regeneration is not available yet.</div>' : '';
    return `<form id="draft-editor" class="editor-grid"><p class="action-note">Text edits create a new revision and invalidate approvals tied to the previous copy. Media files remain unchanged. Save first, then review the new hash.</p><label class="field"><span>Internal title</span><input name="title" value="${esc(draft.title)}" required></label>${slidesReadOnly}${mediaSyncNote}<label class="field"><span>Caption</span><textarea name="caption">${esc(draft.caption)}</textarea></label><label class="field"><span>Hashtags · one per line</span><textarea name="hashtags">${esc(hashtagText)}</textarea></label><label class="field"><span>Call to action</span><input name="cta" value="${esc(draft.cta || '')}"></label>${scriptFields ? `<div class="eyebrow">TIMED SCRIPT · READ ONLY</div>${scriptFields}` : ''}${shots ? `<div class="eyebrow">SHOT LIST · READ ONLY</div>${shots}` : ''}<div class="editor-actions"><button type="submit" class="button primary">Save new revision</button><span id="dirty-note" class="dirty-note">No unsaved changes</span></div>${hash}</form>`;
  }

  function renderReview(draft, canReview) {
    const recent = state.approvals.filter(item => item.draftId === draft.id).slice(0, 3).map(item => `<div class="peek-row"><span class="peek-day">${statusBadge(item.status)}</span><span><b>${esc(item.target?.platform || item.platform)} · r${esc(item.revision)}</b><span>${esc(item.action || 'approval')} · ${fmtDate(item.createdAt || item.scheduledAt)}</span></span></div>`).join('');
    const reviewPlatforms = (draft.platforms || []).filter(platform => !isReel(draft) || platform === 'instagram');
    const platformOptions = reviewPlatforms.map(platform => `<option value="${esc(platform)}">${esc(platform)}</option>`).join('');
    const selectedPlatform = reviewPlatforms[0];
    const accountOptions = state.accounts.filter(account => account.connected && account.platform === selectedPlatform).map(account => `<option value="${esc(account.platform)}:${esc(account.id)}">${esc(account.platform)} · ${esc(account.name)}</option>`).join('');
    const video = isReel(draft) ? reelAsset(draft) : null;
    const firstSlideAsset = draft.slides?.length ? slideAsset(draft, 0, draft.slides[0]) : null;
    const preview = video?.available && assetUrl(video) ? `<video class="review-video" controls preload="metadata" src="${esc(assetUrl(video))}" aria-label="${esc(draft.title)} concept storyboard"></video>` : firstSlideAsset?.available && assetUrl(firstSlideAsset) ? `<img src="${esc(assetUrl(firstSlideAsset))}" alt="First final-media slide">` : '<div class="missing-media">No media</div>';
    const canRecord = canReview.ok && accountOptions;
    const scheduleNote = state.status?.publishingEnabled ? 'This records the schedule approval. Execution remains a separate service action.' : 'The approval may be recorded locally, but the disabled server switch prevents delivery to Meta.';
    return `<div class="review-panel"><div class="eyebrow">HUMAN DECISION · EXACT REVISION</div><h3>Review revision ${esc(draft.revision ?? '—')}</h3><p>${esc(canReview.note)}</p><div class="hashline"><b>Content SHA-256:</b> ${esc(draft.contentSha256 || 'unavailable')}</div><div class="review-grid offset-top"><label class="field"><span>Reviewer identity</span><input id="decision-reviewer" placeholder="Enter your name" autocomplete="name"></label><label class="field"><span>Decision note</span><textarea id="decision-note" class="review-note" placeholder="Required for rejection or requested changes"></textarea></label></div><div class="review-actions offset-small"><button class="button secondary" data-decision="request_changes">Request changes</button><button class="button danger" data-decision="reject">Reject draft</button><span class="action-note">Decision is logged against this exact revision and does not publish.</span></div></div>
      <div class="review-panel"><div class="eyebrow">APPROVAL RECORD</div><h3>Choose destination and time</h3><p>${esc(scheduleNote)} Approval captures the complete media, full caption, platform, account, action, time, reviewer, revision, and hash.</p><div class="approval-preview">${preview}<span><b>${esc(draft.title)}</b><p>${esc(draft.caption || '')}</p><p>${esc((draft.hashtags || []).join(' '))}</p>${draft.mediaDisclosure ? `<p class="media-disclosure">${esc(draft.mediaDisclosure)}</p>` : ''}</span></div><div class="review-grid"><label class="field"><span>Platform</span><select id="review-platform">${platformOptions}</select></label><label class="field"><span>Connected account</span><select id="review-account">${accountOptions || '<option value="">No connected account for this platform</option>'}</select></label><label class="field"><span>Action</span><select id="review-action"><option value="publish_now">Publish now · approval only</option><option value="schedule">Schedule · approval only</option></select></label><label id="review-time-wrap" class="field" hidden><span>Scheduled time · ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time')}</span><input type="datetime-local" id="review-time"></label></div><label class="attest"><input id="review-attest" type="checkbox"><span>I reviewed the exact ${isReel(draft) ? 'concept storyboard video' : `${esc(draft.slides?.length || 0)} media slides`} and the full caption with hashtags above. I understand this records an approval only.</span></label><div class="review-actions"><button class="button primary" id="open-approval" ${canRecord ? '' : 'disabled'}>Review exact approval →</button><span class="action-note">${canRecord ? 'A confirmation step will show the complete receipt.' : esc(canReview.note || 'Connect a real account before approval.')}</span></div></div>
      ${recent ? `<div class="surface-section section-gap-sm"><div class="eyebrow">RECENT APPROVALS</div>${recent}</div>` : ''}`;
  }

  function renderCalendar() {
    const host = $('#view-calendar');
    if (!host) return;
    const dataCalendar = state.calendar;
    const rows = dataCalendar.map(item => {
      const linked = item.contentId ? draftById(item.contentId) : null;
      const title = linked?.title || item.prompt || (item.type === 'rest' ? 'Rest / replies' : 'Story idea');
      const text = [item.note, item.prompt].filter(Boolean).join(' · ');
      return `<article class="calendar-item"><div class="calendar-day">Day ${esc(item.day)}<small>relative</small></div><div><span class="kind-tag ${esc(item.type)}">${esc(item.type)}</span><h3>${linked ? `<button class="text-link" data-open-draft="${esc(linked.id)}">${esc(title)} ↗</button>` : esc(title)}</h3><p>${esc(text)}</p></div><span class="calendar-date">${linked ? esc(linked.id) : '—'}</span></article>`;
    }).join('');
    host.innerHTML = `${pageHeading('EDITORIAL CADENCE', 'Calendar', 'A relative campaign outline. These day numbers are not dates or scheduled posts.')}
      <div class="calendar-tools"><div class="relative-warning">Relative days only · No publishing schedule is created here.</div><span class="action-note">${dataCalendar.length ? `${dataCalendar.length} source entries` : 'Calendar data is not included by the current API response.'}</span></div>
      ${rows ? `<div class="calendar-list">${rows}</div>` : `<div class="empty-state"><div class="empty-mark">▦</div><h3>Calendar data unavailable</h3><p>The local service did not return the campaign outline. No dates are invented.</p></div>`}`;
  }

  function renderHistory() {
    const host = $('#view-history');
    if (!host) return;
    const resolvedAttempts = new Set(state.activity.filter(item => item.type === 'outcome_resolved').map(item => item.attemptId));
    const rows = state.activity.map(item => {
      const when = item.createdAt || item.at || item.timestamp;
      const kind = item.type || item.action || item.event || 'audit event';
      const id = item.draftId || item.contentId;
      const details = [id && draftName(id), item.note, item.message, item.platform && `Platform: ${item.platform}`, item.accountName && `Account: ${item.accountName}`, item.revision && `Revision ${item.revision}`, item.contentSha256 && `SHA ${shortHash(item.contentSha256)}`].filter(Boolean).join(' · ');
      const recovery = item.type === 'publish_outcome_unknown' && item.attemptId && !resolvedAttempts.has(item.attemptId)
        ? `<div class="approval-control"><small>Check the destination manually before resolving. This does not retry publishing.</small><button class="button secondary small" data-resolve-unknown="${esc(item.attemptId)}" data-approval-id="${esc(item.approvalId || '')}">Record human resolution</button></div>` : '';
      return `<div class="activity-row"><span class="activity-when">${esc(fmtDate(when))}</span><span class="activity-kind">${esc(kind.replaceAll('_', ' '))}</span><div class="activity-main"><b>${esc(item.approver || item.reviewer || item.status || 'Recorded')}</b><p>${esc(details || 'Audit detail supplied by the local service.')}</p></div>${statusBadge(item.status || 'logged')}${recovery}</div>`;
    }).join('');
    const approvals = state.approvals.map(item => `<div class="activity-row"><span class="activity-when">${esc(fmtDate(item.createdAt || item.approvedAt))}</span><span class="activity-kind">APPROVAL</span><div class="activity-main"><b>${esc(item.approver || 'Reviewer identity not included')}</b><p>${esc(draftName(item.draftId))} · ${esc(item.target?.platform || item.platform || 'platform')} · ${esc(item.target?.accountName || item.target?.accountId || 'account')} · ${esc(item.action || '')} · r${esc(item.revision)} · ${esc(shortHash(item.contentSha256))}${item.scheduledAt ? ` · ${esc(fmtDate(item.scheduledAt))}` : ''}</p></div><div class="approval-action-cell">${statusBadge(item.status)}${renderApprovalAction(item)}</div></div>`).join('');
    host.innerHTML = `${pageHeading('APPEND-ONLY RECORD', 'History', 'Human decisions and external-action attempts returned by the local audit service.')}
      <div class="surface-section"><div class="section-title"><div><div class="eyebrow">APPROVALS</div><h2>Exact revision records</h2></div><span class="action-note">${state.approvals.length} records</span></div><div class="activity-list">${approvals || '<div class="empty-state"><h3>No approvals recorded</h3><p>Nothing has been approved in this workspace.</p></div>'}</div></div>
      <div class="surface-section section-gap-md"><div class="section-title"><div><div class="eyebrow">ACTIVITY</div><h2>Audit events</h2></div><span class="action-note">Newest first · ${state.activity.length} events</span></div><div class="activity-list">${rows || '<div class="empty-state"><h3>No activity yet</h3><p>Draft reads do not create external actions. Review decisions appear here when recorded.</p></div>'}</div></div>`;
  }

  function renderDiscovery() {
    const host = $('#view-discovery');
    const discovery = state.status?.discovery;
    const hashtagStatus = discovery?.hashtagSearch;
    const ready = discovery?.ready === true;
    const hashtagReady = hashtagStatus?.ready === true;
    const instagramAccounts = state.accounts.filter(account => account.connected && account.platform === 'instagram');
    if (!state.discoveryAccountId || !instagramAccounts.some(account => account.id === state.discoveryAccountId)) {
      state.discoveryAccountId = instagramAccounts[0]?.id || '';
    }
    const accountOptions = instagramAccounts.map(account => `<option value="${esc(account.id)}" ${account.id === state.discoveryAccountId ? 'selected' : ''}>${esc(account.name)} · ${esc(account.id)}</option>`).join('');
    const required = Array.isArray(discovery?.requiredPermissions) ? discovery.requiredPermissions : [];
    const granted = new Set(Array.isArray(discovery?.grantedPermissions) ? discovery.grantedPermissions : []);
    const permissionRows = required.length
      ? required.map(scope => `<div class="discovery-scope"><span>${esc(scope)}</span><b class="${granted.has(scope) ? 'scope-granted' : 'scope-missing'}">${granted.has(scope) ? 'Granted' : 'Missing'}</b></div>`).join('')
      : '<p class="discovery-muted">Required permission status is not available from the local server.</p>';
    const hashtagRequired = Array.isArray(hashtagStatus?.requiredPermissions) ? hashtagStatus.requiredPermissions : [];
    const hashtagGranted = new Set(Array.isArray(hashtagStatus?.grantedPermissions) ? hashtagStatus.grantedPermissions : []);
    const hashtagPermissionRows = hashtagRequired.length
      ? hashtagRequired.map(scope => `<div class="discovery-scope"><span>${esc(scope)}</span><b class="${hashtagGranted.has(scope) ? 'scope-granted' : 'scope-missing'}">${hashtagGranted.has(scope) ? 'Granted' : 'Missing'}</b></div>`).join('')
      : '<p class="discovery-muted">Hashtag permission status is not available.</p>';
    const candidates = state.discoveryCandidates.map(item => {
      const eventDraft = state.eventDrafts.find(draft => draft.candidateId === item.id);
      const eventDraftControl = eventDraft
        ? `<div class="event-draft-inline"><span class="event-revision">Local event draft · r${esc(eventDraft.revision)}</span><button class="button secondary small" type="button" data-open-event-draft="${esc(eventDraft.id)}">${state.selectedEventDraftId === eventDraft.id ? 'Draft open' : 'Edit event draft'}</button></div>`
        : `<button class="button secondary small event-create-button" type="button" data-create-event-draft="${esc(item.id)}" ${state.eventDraftBusy ? 'disabled' : ''}>${state.eventDraftBusy ? 'Creating…' : 'Create event draft'}</button>`;
      return `<article class="discovery-post">
        <div class="discovery-post-top"><div><strong>${item.sourceUsername ? `@${esc(item.sourceUsername)}` : item.sourceHashtag ? `#${esc(item.sourceHashtag)}` : 'Instagram source unavailable'}</strong><span class="discovery-post-time">Posted ${esc(fmtDate(item.postedAt))}</span></div><span class="discovery-review-tag">${esc((item.reviewStatus || 'unreviewed').replaceAll('_', ' '))} · post only</span></div>
        ${Array.isArray(item.sourceAttributions) && item.sourceAttributions.length ? `<div class="discovery-attributions">Found via ${item.sourceAttributions.map(source => `${source.type === 'hashtag' ? '#' : '@'}${esc(source.value)}`).join(' · ')}</div>` : ''}
        ${['IMAGE', 'CAROUSEL_ALBUM'].includes(item.mediaType) && instagramMediaUrl(item.mediaUrl) ? `<img class="discovery-media" src="${esc(instagramMediaUrl(item.mediaUrl))}" alt="Instagram post media preview" loading="lazy" referrerpolicy="no-referrer">` : ''}
        <p class="discovery-caption">${esc(item.caption || '(No caption provided)')}${item.captionTruncated ? '<span class="discovery-truncated">Caption truncated by API</span>' : ''}</p>
        <div class="discovery-post-meta"><span>${esc(item.mediaType || 'Media type unavailable')}</span><span>First seen ${esc(fmtDate(item.firstSeenAt))}</span><span>Collected ${esc(item.collectionCount || 1)}×</span></div>
        ${httpsUrl(item.sourcePermalink) ? `<a class="discovery-link" href="${esc(httpsUrl(item.sourcePermalink))}" target="_blank" rel="noopener noreferrer">Open original Instagram post ↗</a>` : '<span class="discovery-muted">Original post link unavailable</span>'}
        ${eventDraftControl}
      </article>`;
    }).join('');
    const last = state.discoveryLastCollection;
    const collectionMessage = last ? `<div class="discovery-result" role="status">Fetched ${esc(last.returnedCount ?? 0)} post(s) from @${esc(last.username)} · ${esc(last.newCandidateCount ?? 0)} new candidate(s) · ${esc(last.duplicateCount ?? 0)} duplicate(s) · ${esc(fmtDate(last.fetchedAt))}. Nothing has been imported into Yard.</div>` : '';
    const lastHashtag = state.hashtagLastCollection;
    const hashtagMessage = lastHashtag ? `<div class="discovery-result" role="status">Fetched ${esc(lastHashtag.returnedCount ?? 0)} post(s) for #${esc(lastHashtag.hashtag)} · ${esc(lastHashtag.newCandidateCount ?? 0)} new candidate(s) · ${esc(lastHashtag.duplicateCount ?? 0)} duplicate(s) · ${esc(fmtDate(lastHashtag.fetchedAt))}. Nothing has been imported into Yard.</div>` : '';
    const readinessMessage = !discovery
      ? 'API readiness is unknown. Refresh the workspace after the local service responds.'
      : ready
        ? 'Connected Instagram account and required permissions are present. The source username still needs to be publicly accessible to this API account.'
        : `Collection is unavailable until required scopes and an Instagram Professional account are ready. ${Number(discovery.connectedInstagramAccounts || 0)} connected Instagram account(s) · ${Number(discovery.missingPermissions?.length || 0)} required permission(s) missing.`;
    const errorBlock = state.discoveryError ? `<div class="discovery-error" role="alert">${esc(state.discoveryError)}</div>` : '';
    const followingResult = state.followingImportResult ? `<div class="discovery-result" role="status">Imported ${esc(state.followingImportResult.imported ?? 0)} new unverified lead(s) · ${esc(state.followingImportResult.duplicates ?? 0)} duplicate(s) · ${esc(state.followingImportResult.invalid ?? 0)} invalid entry/entries from ${esc(state.followingImportResult.total ?? 0)} relationship(s). No account was qualified.</div>` : '';
    const leadRows = state.discoveryLeads.map(lead => `<div class="discovery-lead"><strong>@${esc(lead.username)}</strong><span>${esc(lead.status || 'unverified')}</span><small>Imported ${esc(fmtDate(lead.firstSeenAt))} · following export</small></div>`).join('');
    const quota = state.hashtagQuota;
    const attempts = Array.isArray(quota?.attempts) ? quota.attempts : [];
    const hashtag = state.discoveryHashtag.trim().replace(/^#/, '').toLowerCase();
    const canRetrySameHashtag = Boolean(hashtag && attempts.some(attempt => String(attempt.hashtag || '').toLowerCase() === hashtag));
    const hashtagQuotaBlocked = Boolean(quota && Number(quota.remaining) <= 0 && !canRetrySameHashtag);
    const quotaAttempts = attempts.slice(0, 8).map(attempt => `<div class="quota-attempt"><span>#${esc(attempt.hashtag)}</span><span>${esc(attempt.status)}${attempt.code ? ` · ${esc(attempt.code)}` : ''}</span><time>${esc(fmtDate(attempt.at))}</time></div>`).join('');
    host.innerHTML = `${pageHeading('CHARLOTTE · SOURCE REVIEW', 'Event discovery', 'Collect public Instagram posts from a connected account into a review queue. This fetches post metadata only; it does not extract event details or import anything into Yard.')}
      <div class="discovery-layout">
        <section class="surface-section discovery-collector">
          <div class="eyebrow">ONE EXPLICIT COLLECTION</div><h2>Choose a source account</h2>
          <p>Each click asks Meta for one first page of up to 25 media posts from the handle you enter. The list is incomplete source material, not an event feed. Check that an account is an official public organizer or venue; registry entries are research leads, not proof of API access.</p>
          <div class="discovery-readiness ${ready ? 'is-ready' : ''}" role="status"><span class="status-dot ${ready ? '' : 'off'}"></span><span>${esc(readinessMessage)}</span></div>
          <div class="discovery-scopes"><b>Required Instagram permissions</b>${permissionRows}</div>
          <form id="discovery-form" class="discovery-form">
            <label class="field"><span>Connected Instagram account</span><select name="accountId" required ${instagramAccounts.length ? '' : 'disabled'}>${accountOptions || '<option value="">No connected Instagram account</option>'}</select></label>
            <label class="field"><span>Public source username</span><input name="username" required maxlength="30" autocomplete="off" value="${esc(state.discoveryUsername)}" placeholder="e.g. campnorthend" aria-describedby="discovery-handle-hint"><small id="discovery-handle-hint">Enter a username from a source you have verified. Do not include the @ symbol.</small></label>
            <button class="button primary" type="submit" ${!ready || !instagramAccounts.length || state.discoveryBusy ? 'disabled' : ''}>${state.discoveryBusy ? 'Collecting posts…' : 'Collect public posts'}</button>
            <p class="discovery-footnote">Collection is user-triggered only. Instagram discovery access and source eligibility can vary; API errors are shown here. No background collection runs.</p>
          </form>
          ${collectionMessage}${errorBlock}
        </section>
        <aside class="surface-section discovery-boundary"><div class="eyebrow">REVIEW BOUNDARY</div><h3>Posts are leads, not events</h3><p>Review the original post and verify the date, time, venue, and location yourself. This panel shows the original caption, optional media preview, and link only; it does not create Yard event records.</p><div class="discovery-source-path">Source research and latest access checks: <code>marketing/discovery/charlotte-sources.json</code>. A successful collection confirms access only for the queried account at that time.</div><div class="discovery-batch">${esc(state.discoveryCandidates.length)} stored post candidate(s)</div></aside>
      </div>
      <div class="discovery-secondary-grid">
        <section class="surface-section discovery-tool-card">
          <div class="eyebrow">LOCAL FILE · NO META CALL</div><h2>Import following export</h2>
          <p>Choose Instagram’s <code>following.json</code> export, which contains a <code>relationships_following</code> array. The browser parses it and POSTs that parsed relationship data to Yard’s local collector; no request goes to Meta.</p>
          <form id="following-import-form" class="discovery-form"><label class="field"><span>Following export JSON</span><input name="followingFile" type="file" accept="application/json,.json" required ${state.followingImportBusy ? 'disabled' : ''}></label><button class="button secondary" type="submit" ${state.followingImportBusy ? 'disabled' : ''}>${state.followingImportBusy ? 'Importing…' : 'Import unverified leads'}</button><p class="discovery-footnote">Every imported username stays <b>unverified</b>. This does not establish Charlotte location, organizer or venue identity, professional account type, or API eligibility.</p></form>
          ${followingResult}${state.discoveryLeadsError ? `<div class="discovery-error" role="alert">${esc(state.discoveryLeadsError)}</div>` : ''}
        </section>
        <section class="surface-section discovery-tool-card">
          <div class="eyebrow">META HASHTAG SEARCH · EXPLICIT ONLY</div><h2>Collect a hashtag</h2>
          <p>Fetch up to 25 recent-media results from the last 24 hours for one hashtag. Stories are not included. Hashtag results do not provide a username field and are not a paid or boosted ad feed; they are organic public-content search results, subject to Meta access rules.</p>
          <div class="discovery-readiness ${hashtagReady ? 'is-ready' : ''}" role="status"><span class="status-dot ${hashtagReady ? '' : 'off'}"></span><span>${hashtagStatus ? `${Number(hashtagStatus.connectedInstagramAccounts || 0)} connected Instagram account(s) · ${Number(hashtagStatus.missingPermissions?.length || 0)} required permission(s) missing · Public Content Access App Review is required, but its approval state is not reported here. An explicit request can diagnose access.` : 'Hashtag API readiness is unknown. Refresh after the local server responds.'}</span></div>
          <div class="discovery-scopes"><b>Hashtag search permissions</b>${hashtagPermissionRows}</div>
          <form id="hashtag-form" class="discovery-form"><label class="field"><span>Connected Instagram account</span><select name="accountId" required ${instagramAccounts.length ? '' : 'disabled'}>${accountOptions || '<option value="">No connected Instagram account</option>'}</select></label><label class="field"><span>Public hashtag</span><input name="hashtag" required maxlength="31" autocomplete="off" value="${esc(state.discoveryHashtag)}" placeholder="cltevents"><small>One hashtag, with or without #. The server strips a leading #.</small></label><button class="button primary" type="submit" ${!hashtagReady || !instagramAccounts.length || !quota || hashtagQuotaBlocked || state.hashtagCollectBusy ? 'disabled' : ''}>${state.hashtagCollectBusy ? 'Collecting hashtag posts…' : 'Collect hashtag posts'}</button><p class="discovery-footnote">No hashtag search runs until you click. This is a conservative count of unique hashtags attempted by this local collector over seven days, not Meta’s authoritative quota. Searches from Graph API Explorer or other tools are not tracked; failed local attempts remain counted. Previously used hashtags may be retried explicitly.</p></form>
          <div class="quota-panel"><div class="quota-top"><b>Rolling 7-day local estimate</b><span>${quota ? `${esc(quota.used)} / ${esc(quota.limit)} unique · ${esc(quota.remaining)} left` : 'Quota unavailable'}</span></div>${state.hashtagQuotaError ? `<div class="discovery-error" role="alert">${esc(state.hashtagQuotaError)}</div>` : ''}${quotaAttempts || '<p class="discovery-muted">No hashtag attempts in the current local window.</p>'}</div>
          ${hashtagMessage}${state.hashtagQuota && Number(state.hashtagQuota.remaining) <= 0 && !canRetrySameHashtag ? '<div class="discovery-error" role="status">The local seven-day unique hashtag limit is reached. A previously attempted hashtag may still be retried.</div>' : ''}${state.hashtagError ? `<div class="discovery-error" role="alert">${esc(state.hashtagError)}</div>` : ''}
        </section>
      </div>
      <section class="discovery-queue"><div class="section-title"><div><div class="eyebrow">UNVERIFIED FOLLOWING IMPORTS</div><h2>Source leads</h2></div><span class="action-note">${esc(state.discoveryLeads.length)} lead(s) · none auto-qualified</span></div>${leadRows ? `<div class="discovery-lead-list">${leadRows}</div>` : `<div class="empty-state"><h3>No source leads imported</h3><p>Following relationships are only unverified handles, not proof of location, business identity, or eligibility.</p></div>`}</section>
      <section class="discovery-queue"><div class="section-title"><div><div class="eyebrow">UNPROCESSED SOURCE MATERIAL</div><h2>Collected posts</h2></div><button type="button" class="button secondary small" data-refresh-discovery>Refresh candidates</button></div>
        ${state.discoveryCandidates.length ? `<div class="discovery-post-list">${candidates}</div>` : `<div class="empty-state"><h3>No collected posts yet</h3><p>Choose a connected account and explicitly collect from a verified public source username.</p></div>`}
      </section>
      <section class="surface-section event-export-panel"><div><div class="eyebrow">OWNER SUBMISSION FILE</div><h2>Prepare events.json</h2><p><b>Pending file for your review; nothing submitted. Submit yourself, then approve in Supabase Studio.</b> The download contains only complete saved drafts. This dashboard never writes event rows.</p><div class="event-export-count">${esc(state.eventReviewStatus?.exportableCount ?? '—')} complete draft(s) ready · ${esc(state.eventReviewStatus?.draftsCount ?? state.eventDrafts.length)} total local draft(s)</div></div><button type="button" class="button primary" data-download-event-inbox ${!state.eventReviewStatus?.exportableCount || state.eventDraftBusy || state.eventDraftDirty ? 'disabled' : ''}>Download events.json for review</button>${state.eventReviewStatusError ? `<div class="discovery-error" role="alert">${esc(state.eventReviewStatusError)}</div>` : ''}${state.eventDraftError && !state.selectedEventDraftId ? `<div class="discovery-error" role="alert">${esc(state.eventDraftError)}</div>` : ''}${state.eventReviewResult && !state.selectedEventDraftId ? `<div class="discovery-result" role="status">${esc(state.eventReviewResult)}</div>` : ''}</section>
      ${renderEventDraftEditor()}`;
    $('#discovery-form', host)?.addEventListener('submit', collectInstagramPosts);
    $('[data-refresh-discovery]', host)?.addEventListener('click', refreshDiscoveryData);
    $('#discovery-form [name="accountId"]', host)?.addEventListener('change', event => { state.discoveryAccountId = event.currentTarget.value; });
    $('#discovery-form [name="username"]', host)?.addEventListener('input', event => { state.discoveryUsername = event.currentTarget.value; });
    $('#following-import-form', host)?.addEventListener('submit', importFollowingExport);
    $('#hashtag-form', host)?.addEventListener('submit', collectHashtagPosts);
    $('#hashtag-form [name="accountId"]', host)?.addEventListener('change', event => { state.discoveryAccountId = event.currentTarget.value; });
    $('#hashtag-form [name="hashtag"]', host)?.addEventListener('input', event => {
      state.discoveryHashtag = event.currentTarget.value;
      const value = state.discoveryHashtag.trim().replace(/^#/, '').toLowerCase();
      const mayRetry = Boolean(value && Array.isArray(state.hashtagQuota?.attempts) && state.hashtagQuota.attempts.some(attempt => String(attempt.hashtag || '').toLowerCase() === value));
      const blocked = !state.hashtagQuota || (Number(state.hashtagQuota.remaining) <= 0 && !mayRetry);
      const button = $('#hashtag-form button[type="submit"]', host);
      if (button) button.disabled = !hashtagReady || !instagramAccounts.length || blocked || state.hashtagCollectBusy;
    });
    $$('[data-create-event-draft]', host).forEach(button => button.addEventListener('click', () => createEventDraft(button.dataset.createEventDraft)));
    $$('[data-open-event-draft]', host).forEach(button => button.addEventListener('click', () => openEventDraft(button.dataset.openEventDraft)));
    $('#event-draft-form', host)?.addEventListener('input', event => {
      if (event.target.matches('[data-event-content]')) {
        state.eventDraftDirty = true;
        const note = $('#event-draft-dirty-note', host);
          if (note) note.textContent = 'Unsaved edits · save to create a new local revision.';
        updateEventDraftActionButtons(host);
      }
    });
    $('#event-draft-form', host)?.addEventListener('submit', saveEventDraft);
    $('[data-download-event-inbox]', host)?.addEventListener('click', downloadEventInbox);
  }

  function renderEventDraftEditor() {
    const draft = state.eventDrafts.find(item => item.id === state.selectedEventDraftId);
    if (!state.selectedEventDraftId) return '';
    if (!draft) return `<section class="surface-section event-draft-editor"><div class="eyebrow">LOCAL EVENT REVIEW</div><h2>Event draft unavailable</h2><p>${esc(state.eventDraftError || 'The local service did not return this draft.')}</p></section>`;
    const source = draft.source || {};
    const sourceOrigin = source.sourceUsername ? `@${source.sourceUsername}` : source.sourceHashtag ? `#${source.sourceHashtag}` : 'Instagram source';
    const originalLink = httpsUrl(source.sourcePermalink);
    const offsetChoices = offset => `<option value="" ${!offset ? 'selected' : ''}>Choose UTC offset…</option><option value="-04:00" ${offset === '-04:00' ? 'selected' : ''}>EDT · UTC−04:00</option><option value="-05:00" ${offset === '-05:00' ? 'selected' : ''}>EST · UTC−05:00</option>`;
    const dirty = state.eventDraftDirty;
    const statusLine = `<span class="event-revision">Local draft · revision ${esc(draft.revision ?? '—')}</span>`;
    const errors = state.eventDraftError ? `<div class="discovery-error" role="alert">${esc(state.eventDraftError)}</div>` : '';
    const result = state.eventReviewResult ? `<div class="discovery-result" role="status">${esc(state.eventReviewResult)}</div>` : '';
    const preview = `${source.caption ? `<blockquote class="event-source-caption">${esc(source.caption)}</blockquote>` : '<p class="discovery-muted">No original caption is available.</p>'}${source.postedAt ? `<p class="event-source-time">Original post time: ${esc(fmtDate(source.postedAt))} · not the event time</p>` : ''}${originalLink ? `<a class="discovery-link" href="${esc(originalLink)}" target="_blank" rel="noopener noreferrer">Open original source ↗</a>` : '<span class="discovery-muted">Original source permalink unavailable.</span>'}`;
    return `<section class="surface-section event-draft-editor" id="event-draft-editor"><div class="event-editor-heading"><div><div class="eyebrow">EDITABLE EVENT DRAFT · SOURCE ${esc(sourceOrigin)}</div><h2>Build an event draft</h2><p>Start with verified details from the source. The post timestamp is not an event date. Saving changes creates a revision; it does not submit or approve it.</p></div><div>${statusLine}</div></div>
      <div class="event-source-preview"><div><div class="eyebrow">ORIGINAL SOURCE · READ ONLY</div>${preview}</div><div class="event-draft-controls"><div class="discovery-readiness is-ready" role="status"><span class="status-dot"></span><span>Local event draft only · live event writes are disabled.</span></div><p class="event-warning">No inferred details. Verify title, description, date, time, venue, and address from the original post or another reliable source. Nothing is submitted.</p></div></div>
      <form id="event-draft-form" class="event-draft-form">
        <div class="event-field-grid">
          <label class="field"><span>Event title · required</span><input name="title" data-event-content maxlength="120" value="${esc(draft.title || '')}" required></label>
          <label class="field"><span>Venue · optional</span><input name="venue" data-event-content maxlength="120" value="${esc(draft.venue || '')}"></label>
          <label class="field event-span-two"><span>Event description/details · your own words (optional)</span><textarea name="details" data-event-content maxlength="1000">${esc(draft.details || '')}</textarea></label>
          <label class="field"><span>Event starts · Charlotte wall time (${esc('America/New_York')})</span><input type="datetime-local" name="startsAtLocal" data-event-content value="${esc(datetimeInputValue(draft.starts_at))}" required></label>
          <label class="field"><span>Start offset · required explicitly</span><select name="startsAtOffset" data-event-content required>${offsetChoices(datetimeOffset(draft.starts_at))}</select></label>
          <label class="field"><span>Event ends · optional Charlotte wall time</span><input type="datetime-local" name="endsAtLocal" data-event-content value="${esc(datetimeInputValue(draft.ends_at))}"></label>
          <label class="field"><span>End offset · required when end is set</span><select name="endsAtOffset" data-event-content>${offsetChoices(datetimeOffset(draft.ends_at))}</select></label>
          <label class="field event-span-two"><span>Venue address · optional</span><input name="address" data-event-content maxlength="200" value="${esc(draft.address || '')}"></label>
          <label class="field event-span-two"><span>Evidence notes · how date, place, and details were verified</span><textarea name="evidenceNotes" data-event-content maxlength="2000">${esc(draft.evidenceNotes || '')}</textarea></label>
          <label class="field event-span-two"><span>Reference URLs · one HTTPS link per line</span><textarea name="referenceUrls" data-event-content maxlength="2000">${esc((draft.referenceUrls || []).join('\n'))}</textarea></label>
        </div>
        <div class="event-save-row"><button type="submit" class="button primary" ${state.eventDraftBusy ? 'disabled' : ''}>${state.eventDraftBusy ? 'Saving…' : 'Save event draft'}</button><span id="event-draft-dirty-note" class="action-note">${esc(state.eventDraftDirty ? 'Unsaved edits · save to create the next local revision.' : 'Source provenance is immutable; event details remain human-edited.')}</span></div>
      </form>
      <div class="event-export-panel"><div class="event-warning"><b>Pending file for your review; nothing submitted. Submit yourself, then approve in Supabase Studio.</b><br>Save this draft, then use “Download events.json for review” below. This dashboard does not submit or approve events.</div></div>${errors}${result}</section>`;
  }

  function storeEventDraft(draft) {
    const index = state.eventDrafts.findIndex(item => item.id === draft.id);
    if (index >= 0) state.eventDrafts[index] = draft;
    else state.eventDrafts.unshift(draft);
    state.selectedEventDraftId = draft.id;
    state.eventDraftDirty = false;
    state.eventDraftError = '';
  }

  async function createEventDraft(candidateId) {
    if (state.eventDraftBusy) return;
    if (!state.discoveryCandidates.some(item => item.id === candidateId)) { state.eventDraftError = 'The source post is no longer in the candidate list. Refresh candidates and try again.'; renderDiscovery(); return; }
    state.eventDraftBusy = true;
    state.eventDraftError = '';
    renderDiscovery();
    try {
      const result = await request('/api/event-review/drafts', { method: 'POST', body: JSON.stringify({ candidateId }) });
      storeEventDraft(result.draft || result);
      state.eventReviewResult = 'Created a blank event draft from this post’s provenance. No fields or event date were inferred.';
      await refreshDiscoveryData();
      toast('Blank local event draft created. Verify every event detail against the source.');
    } catch (error) {
      state.eventDraftError = `${error.code ? `${error.code}: ` : ''}${errorMessage(error)}`;
    } finally {
      state.eventDraftBusy = false;
      renderDiscovery();
    }
  }

  async function openEventDraft(id) {
    state.selectedEventDraftId = id;
    state.eventDraftDirty = false;
    state.eventDraftError = '';
    state.eventReviewResult = '';
    renderDiscovery();
    try {
      const result = await request(`/api/event-review/drafts/${encodeURIComponent(id)}`);
      storeEventDraft(result.draft || result);
      renderDiscovery();
      $('#event-draft-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      state.eventDraftError = `${error.code ? `${error.code}: ` : ''}${errorMessage(error)}`;
      renderDiscovery();
    }
  }

  function updateEventDraftActionButtons(host) {
    $$('[data-download-event-inbox]', host).forEach(button => { button.disabled = state.eventDraftBusy || state.eventDraftDirty || !state.eventReviewStatus?.exportableCount; });
  }

  async function saveEventDraft(event) {
    event.preventDefault();
    if (state.eventDraftBusy) return;
    const draft = state.eventDrafts.find(item => item.id === state.selectedEventDraftId);
    if (!draft) return;
    const data = new FormData(event.currentTarget);
    const startsAt = withExplicitOffset(String(data.get('startsAtLocal') || ''), String(data.get('startsAtOffset') || ''));
    const endsAtLocal = String(data.get('endsAtLocal') || '');
    const endsAt = endsAtLocal ? withExplicitOffset(endsAtLocal, String(data.get('endsAtOffset') || '')) : null;
    if (!startsAt) { state.eventDraftError = 'Enter the event start and choose its explicit Charlotte UTC offset.'; renderDiscovery(); return; }
    if (endsAtLocal && !endsAt) { state.eventDraftError = 'Choose the explicit UTC offset for the optional end time.'; renderDiscovery(); return; }
    const referenceUrls = String(data.get('referenceUrls') || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const payload = {
      expectedRevision: draft.revision,
      title: String(data.get('title') || '').trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      venue: String(data.get('venue') || '').trim(),
      address: String(data.get('address') || '').trim(),
      details: String(data.get('details') || '').trim(),
      evidenceNotes: String(data.get('evidenceNotes') || '').trim(),
      referenceUrls
    };
    state.eventDraftBusy = true;
    state.eventDraftError = '';
    renderDiscovery();
    try {
      const result = await request(`/api/event-review/drafts/${encodeURIComponent(draft.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      storeEventDraft(result.draft || result);
      state.eventReviewResult = `Saved local event draft revision ${state.eventDrafts.find(item => item.id === draft.id)?.revision}. It has not been submitted.`;
      await refreshDiscoveryData();
      toast('Event draft saved as a new revision.');
    } catch (error) {
      state.eventDraftError = `${error.code ? `${error.code}: ` : ''}${errorMessage(error)}`;
    } finally {
      state.eventDraftBusy = false;
      renderDiscovery();
    }
  }

  async function downloadEventInbox() {
    if (state.eventDraftBusy) return;
    if (state.eventDraftDirty) { state.eventDraftError = 'Save edits before preparing the owner submission file.'; renderDiscovery(); return; }
    if (!Number(state.eventReviewStatus?.exportableCount || 0)) { state.eventDraftError = 'There are no complete saved event drafts ready for export.'; renderDiscovery(); return; }
    state.eventDraftBusy = true;
    state.eventDraftError = '';
    renderDiscovery();
    try {
      const result = await request('/api/event-review/export');
      if (!Array.isArray(result.events) || result.events.length === 0) throw new Error('The local service returned no complete event drafts for export.');
      const allowed = new Set(['title', 'starts_at', 'ends_at', 'venue', 'address', 'link', 'details', 'source_handle']);
      const valid = result.events.every(event => event && typeof event.title === 'string' && typeof event.starts_at === 'string' && Object.keys(event).every(key => allowed.has(key)));
      if (!valid) throw new Error('The export did not match the event submission inbox fields. No file was downloaded.');
      const content = JSON.stringify(result.events, null, 2);
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'events.json';
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      state.eventReviewResult = 'Pending file for your review; nothing submitted. Submit yourself, then approve in Supabase Studio.';
      toast('Downloaded events.json for your review. Nothing was submitted.');
    } catch (error) {
      state.eventDraftError = `${error.code ? `${error.code}: ` : ''}${errorMessage(error)}`;
    } finally {
      state.eventDraftBusy = false;
      renderDiscovery();
    }
  }
  async function refreshDiscoveryData() {
    const [candidateResult, leadResult, quotaResult, eventDraftResult, eventStatusResult] = await Promise.all([
      fetchOptional('/api/discovery/candidates', 'Post candidates'),
      fetchOptional('/api/discovery/leads', 'Source leads'),
      fetchOptional('/api/discovery/quota', 'Hashtag quota'),
      fetchOptional('/api/event-review/drafts', 'Event drafts'),
      fetchOptional('/api/event-review/status', 'Event review')
    ]);
    state.discoveryCandidates = Array.isArray(candidateResult.data?.candidates) ? candidateResult.data.candidates : [];
    state.discoveryError = candidateResult.error || '';
    state.discoveryLeads = Array.isArray(leadResult.data?.leads) ? leadResult.data.leads : [];
    state.discoveryLeadsError = leadResult.error || '';
    state.hashtagQuota = quotaResult.data?.quota || null;
    state.hashtagQuotaError = quotaResult.error || '';
    state.eventDrafts = Array.isArray(eventDraftResult.data?.drafts) ? eventDraftResult.data.drafts : [];
    state.eventReviewStatus = eventStatusResult.data || null;
    state.eventReviewStatusError = eventStatusResult.error || '';
    renderDiscovery();
  }

  async function collectInstagramPosts(event) {
    event.preventDefault();
    if (state.discoveryBusy) return;
    if (state.status?.discovery?.ready !== true) { state.discoveryError = 'Instagram discovery is not ready. Check the connected account and required permissions.'; renderDiscovery(); return; }
    const data = new FormData(event.currentTarget);
    const accountId = String(data.get('accountId') || '');
    const username = String(data.get('username') || '').trim().replace(/^@/, '');
    state.discoveryUsername = username;
    if (!accountId || !username) { state.discoveryError = 'Select a connected Instagram account and enter a public source username.'; renderDiscovery(); return; }
    if (!state.accounts.some(account => account.id === accountId && account.connected && account.platform === 'instagram')) {
      state.discoveryError = 'That account is not in the current connected Instagram account list. Refresh the workspace and try again.'; renderDiscovery(); return;
    }
    state.discoveryBusy = true;
    state.discoveryError = '';
    state.discoveryMessage = '';
    renderDiscovery();
    try {
      const result = await request('/api/discovery/instagram/collect', { method: 'POST', body: JSON.stringify({ accountId, username }) });
      state.discoveryLastCollection = result.collection || null;
      state.discoveryCandidates = Array.isArray(result.candidates) ? result.candidates : state.discoveryCandidates;
      state.discoveryMessage = 'Collection finished. Posts remain review-only source material.';
      await refreshDiscoveryData();
      toast('Instagram posts collected for review. No events were created.');
    } catch (error) {
      state.discoveryError = `${error.code ? `${error.code}: ` : ''}${errorMessage(error)}`;
    } finally {
      state.discoveryBusy = false;
      renderDiscovery();
    }
  }

  async function importFollowingExport(event) {
    event.preventDefault();
    if (state.followingImportBusy) return;
    const file = new FormData(event.currentTarget).get('followingFile');
    if (!(file instanceof File) || !file.size) { state.discoveryLeadsError = 'Choose an Instagram following export JSON file.'; renderDiscovery(); return; }
    if (file.size > 900_000) { state.discoveryLeadsError = 'Choose a JSON file under 900 KB; the local API has a 1 MB request limit.'; renderDiscovery(); return; }
    state.followingImportBusy = true;
    state.discoveryLeadsError = '';
    renderDiscovery();
    try {
      let parsed;
      try { parsed = JSON.parse(await file.text()); }
      catch { throw new Error('The selected file is not valid JSON.'); }
      if (!Array.isArray(parsed?.relationships_following)) throw new Error('This file does not contain an Instagram relationships_following array.');
      const result = await request('/api/discovery/following/import', { method: 'POST', body: JSON.stringify({ relationships_following: parsed.relationships_following }) });
      state.followingImportResult = result;
      await refreshDiscoveryData();
      toast(`Imported ${result.imported ?? 0} unverified source lead(s).`);
    } catch (error) {
      state.discoveryLeadsError = error.message || errorMessage(error);
      if (error.code) state.discoveryLeadsError = `${error.code}: ${state.discoveryLeadsError}`;
    } finally {
      state.followingImportBusy = false;
      renderDiscovery();
    }
  }

  async function collectHashtagPosts(event) {
    event.preventDefault();
    if (state.hashtagCollectBusy) return;
    const hashtagStatus = state.status?.discovery?.hashtagSearch;
    if (hashtagStatus?.ready !== true) { state.hashtagError = 'Hashtag search is not ready. Check the connected Instagram account and required permissions.'; renderDiscovery(); return; }
    const data = new FormData(event.currentTarget);
    const accountId = String(data.get('accountId') || '');
    const hashtag = String(data.get('hashtag') || '').trim().replace(/^#/, '');
    state.discoveryHashtag = hashtag;
    if (!accountId || !hashtag) { state.hashtagError = 'Select a connected Instagram account and enter one hashtag.'; renderDiscovery(); return; }
    if (!state.accounts.some(account => account.id === accountId && account.connected && account.platform === 'instagram')) {
      state.hashtagError = 'That account is not in the connected Instagram account list. Refresh the workspace and try again.'; renderDiscovery(); return;
    }
    const quota = state.hashtagQuota;
    const priorAttempt = Array.isArray(quota?.attempts) && quota.attempts.some(attempt => String(attempt.hashtag || '').toLowerCase() === hashtag.toLowerCase());
    if (!quota || (Number(quota.remaining) <= 0 && !priorAttempt)) { state.hashtagError = 'Quota is unavailable or the rolling seven-day unique hashtag limit is reached. Refresh quota or retry a previously attempted hashtag.'; renderDiscovery(); return; }
    state.hashtagCollectBusy = true;
    state.hashtagError = '';
    renderDiscovery();
    try {
      const result = await request('/api/discovery/instagram/hashtag/collect', { method: 'POST', body: JSON.stringify({ accountId, hashtag }) });
      state.hashtagLastCollection = result.collection || null;
      state.discoveryCandidates = Array.isArray(result.candidates) ? result.candidates : state.discoveryCandidates;
      if (result.collection?.quota) state.hashtagQuota = result.collection.quota;
      await refreshDiscoveryData();
      toast('Hashtag posts collected for review. No event records were created.');
    } catch (error) {
      state.hashtagError = `${error.code ? `${error.code}: ` : ''}${errorMessage(error)}`;
      try {
        const quotaResult = await request('/api/discovery/quota');
        state.hashtagQuota = quotaResult.quota || null;
      } catch (quotaError) { state.hashtagQuotaError = `Could not refresh quota: ${errorMessage(quotaError)}`; }
    } finally {
      state.hashtagCollectBusy = false;
      renderDiscovery();
    }
  }

  function renderApprovalAction(approval) {
    if (approval.status !== 'approved') return '';
    if (approval.action === 'schedule') {
      const scheduleNote = state.status?.publishingEnabled
        ? `Server scheduler runs at ${fmtDate(approval.scheduledAt)}. Revoke before execution to cancel.`
        : 'Server scheduler is paused by the publishing flag. Revoke before execution to cancel this approval.';
      return `<div class="approval-control"><small>${esc(scheduleNote)}</small><button class="button secondary small" data-revoke="${esc(approval.id)}">Revoke schedule</button></div>`;
    }
    if (approval.action === 'publish_now') {
      return state.status?.publishingEnabled
        ? `<div class="approval-control"><small>Requires a separate human confirmation.</small><button class="button primary small" data-execute="${esc(approval.id)}">Execute approved post</button><button class="button secondary small" data-revoke="${esc(approval.id)}">Revoke</button></div>`
        : `<div class="approval-control"><small>Execution disabled by server setting <code>YARD_META_PUBLISH_ENABLED=false</code>.</small><button class="button secondary small" disabled>Execution disabled</button><button class="button secondary small" data-revoke="${esc(approval.id)}">Revoke</button></div>`;
    }
    return '';
  }

  function renderInsights() {
    const host = $('#view-insights');
    if (!host) return;
    if (!state.insights && !state.insightsError) {
      fetchOptional('/api/insights', 'Insights').then(result => {
        state.insights = result.data;
        state.insightsError = result.error;
        renderInsights();
      });
      state.insightsError = 'Loading verified account metrics…';
    }
    const notReady = !state.insights || state.insightsError;
    const message = /501|not[_ ]implemented/i.test(state.insightsError || '')
      ? 'The backend has not implemented Meta insights yet. No impressions, reach, or engagement numbers are shown.'
      : state.insightsError || 'No verified metrics are available from the connected platform.';
    host.innerHTML = `${pageHeading('MEASURE WHAT EXISTS', 'Insights', 'Only platform data returned by the API belongs here. No sample metrics.')}
      <div class="analytics-layout"><section class="surface-section analytics-empty">${notReady ? `<div class="eyebrow">NO LIVE METRICS</div><h2>Analytics are not connected yet.</h2><p>${esc(message)}</p><p class="action-note">When a verified API endpoint and account permissions are available, this page can display sourced metrics. No values are estimated or mocked.</p>` : `<div class="eyebrow">API DATA</div><h2>Verified insights</h2><pre>${esc(JSON.stringify(state.insights, null, 2))}</pre>`}</section><aside class="surface-section"><div class="eyebrow">CURRENT DATA SOURCE</div><h3>Platform insights</h3><div class="check-row"><i class="status-dot off"></i><div><b>${esc(state.accounts.some(a => a.connected) ? 'Connected account' : 'No connected account')}</b><p>Metrics require a supported account and a verified permission set.</p></div></div><div class="check-row"><i class="status-dot off"></i><div><b>Endpoint status</b><p>${esc(state.insightsError || 'Not requested')}</p></div></div></aside></div>`;
  }

  function renderIdeas() {
    const host = $('#view-ideas');
    if (!host) return;
    const provider = state.provider;
    const selected = currentDraft();
    const remaining = Math.max(0, Number(provider?.budgetUsd || 0) - Number(provider?.spentUsd || 0));
    const freeTemplate = provider?.provider === 'template';
    const configured = Boolean(provider?.enabled && provider?.provider && provider?.model && (freeTemplate || provider?.budgetUsd > 0));
    const enabled = configured && (freeTemplate || remaining > 0);
    const providerActionCopy = provider?.provider === 'template'
      ? 'I understand this runs the local text template and creates an unapproved draft revision; it does not send content to a paid API.'
      : 'I understand this sends the prompt to the configured model and creates an unapproved draft revision.';
    const options = state.drafts.map(draft => `<option value="${esc(draft.id)}" ${draft.id === state.selectedId ? 'selected' : ''}>${esc(draft.id)} · ${esc(draft.title)}</option>`).join('');
    host.innerHTML = `${pageHeading('MODEL-ASSISTED DRAFTING', 'Ideas & providers', 'One explicit prompt can create a new revision. Nothing is regenerated in the background.')}
      <div class="idea-layout"><form id="idea-form" class="idea-form"><div class="eyebrow">REGENERATE A DRAFT</div><h2>Find another useful angle.</h2><p>This uses the explicitly configured provider and model for copy generation only. It does not browse the web, make research claims, approve a draft, or publish anything.</p><label class="field"><span>Draft to revise</span><select name="draftId" required>${options || '<option value="">No drafts loaded</option>'}</select></label><label class="field"><span>What should change?</span><textarea name="prompt" required placeholder="Example: Keep the Charlotte-first voice, but make the practical tip more specific. Avoid promising availability or inventing local events."></textarea></label><label class="attest"><input type="checkbox" name="confirm" ${enabled ? '' : 'disabled'}><span>${esc(providerActionCopy)}</span></label><button class="button primary" type="submit" ${enabled ? '' : 'disabled'}>Generate a new revision →</button><p class="action-note">${enabled ? 'The generated revision returns to Drafts and needs a human review.' : 'Regeneration is off until a provider, model, and positive spend budget are explicitly configured.'}</p><div id="idea-result"></div></form>
      <aside class="provider-card"><div class="eyebrow">PROVIDER STATUS</div><h3>${enabled ? freeTemplate ? 'Local template is ready' : 'Configured for explicit use' : configured && remaining <= 0 ? 'Configured budget exhausted' : 'No model is enabled'}</h3><div class="provider-row"><span>Provider</span><b>${esc(provider?.provider || 'none')}</b></div><div class="provider-row"><span>Model</span><b>${esc(provider?.model || 'not selected')}</b></div><div class="provider-row"><span>Enabled</span><b>${provider?.enabled ? 'Yes' : 'No'}</b></div><div class="provider-row"><span>Spend cap</span><b>${freeTemplate ? 'Local · $0.00' : `$${Number(provider?.budgetUsd || 0).toFixed(2)}`}</b></div><div class="provider-row"><span>Reported spend</span><b>$${Number(provider?.spentUsd || 0).toFixed(2)}</b></div><div class="provider-row"><span>Remaining cap</span><b>${freeTemplate ? 'No paid API spend' : `$${remaining.toFixed(2)}`}</b></div><p class="provider-note">No default provider is selected. The local template is zero-cost. OpenAI regeneration requires an explicit model, key, rates, and a positive server-side budget. The UI does not change provider settings.</p><div class="provider-actions"><button class="button secondary" data-refresh-provider>Refresh provider status</button></div></aside></div>`;
  }

  function bindDetailEvents() {
    const host = $('#draft-detail-slot');
    if (!host) return;
    const editor = $('#draft-editor', host);
    if (editor) {
      editor.addEventListener('input', () => {
        const note = $('#dirty-note', editor);
        if (note) { note.textContent = 'Unsaved changes'; note.style.color = 'var(--amber)'; }
      });
      editor.addEventListener('submit', saveDraft);
    }
    $('#open-approval', host)?.addEventListener('click', openApprovalDialog);
    $('#review-platform', host)?.addEventListener('change', updateReviewAccounts);
    $('#review-action', host)?.addEventListener('change', updateReviewTime);
    $$('[data-decision]', host).forEach(button => button.addEventListener('click', recordDecision));
  }

  async function saveDraft(event) {
    event.preventDefault();
    const draft = currentDraft();
    if (!draft) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      expectedRevision: draft.revision,
      expectedContentSha256: draft.contentSha256,
      title: formData.get('title'), caption: formData.get('caption'),
      hashtags: String(formData.get('hashtags') || '').split(/[\n,]+/).map(tag => tag.trim()).filter(Boolean),
      cta: formData.get('cta')
    };
    try {
      setBusy(form, true);
      const result = await request(`/api/drafts/${encodeURIComponent(draft.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      const updated = result.draft || result;
      state.draftDetails.set(updated.id, updated);
      const index = state.drafts.findIndex(item => item.id === updated.id);
      if (index >= 0) state.drafts[index] = { ...state.drafts[index], ...updated };
      await refreshAll({ quiet: true });
      state.detailTab = 'media';
      renderDrafts();
      toast(`Saved ${updated.id} as revision ${updated.revision}. Previous approvals are invalidated.`);
    } catch (error) {
      toast(`Could not save this revision: ${errorMessage(error)}`, true);
      setBusy(form, false);
    }
  }

  function setBusy(form, busy) {
    if (!form) return;
    $$('button[type="submit"]', form).forEach(button => { button.disabled = busy; });
  }

  async function recordDecision(event) {
    const draft = currentDraft();
    if (!draft) return;
    const decision = event.currentTarget.dataset.decision;
    const reviewer = $('#decision-reviewer')?.value.trim();
    const note = $('#decision-note')?.value.trim();
    if (!reviewer || !note) { toast('Enter your name and a decision note first.', true); return; }
    const prompt = decision === 'reject' ? 'Reject this draft revision?' : 'Request changes on this draft revision?';
    if (!window.confirm(`${prompt}\n\n${draft.id} · r${draft.revision} · ${shortHash(draft.contentSha256)}\n\nThis records a decision only; it does not publish.`)) return;
    try {
      event.currentTarget.disabled = true;
      await request(`/api/drafts/${encodeURIComponent(draft.id)}/decision`, {
        method: 'POST', body: JSON.stringify({ revision: draft.revision, contentSha256: draft.contentSha256, decision, note, reviewer })
      });
      await refreshAll({ quiet: true });
      state.detailTab = 'review'; renderDrafts();
      toast(`${decision === 'reject' ? 'Rejection' : 'Change request'} recorded for ${draft.id} r${draft.revision}.`);
    } catch (error) {
      event.currentTarget.disabled = false;
      toast(`Decision was not recorded: ${errorMessage(error)}`, true);
    }
  }

  function updateReviewAccounts() {
    const platform = $('#review-platform')?.value;
    const draft = currentDraft();
    const allowed = !isReel(draft) || platform === 'instagram';
    const accounts = allowed ? state.accounts.filter(account => account.connected && account.platform === platform) : [];
    $('#review-account').innerHTML = accounts.length ? accounts.map(account => `<option value="${esc(account.platform)}:${esc(account.id)}">${esc(account.platform)} · ${esc(account.name)}</option>`).join('') : '<option value="">No connected account for this platform</option>';
    const button = $('#open-approval');
    if (button) button.disabled = !accounts.length;
  }

  function updateReviewTime() {
    const isSchedule = $('#review-action')?.value === 'schedule';
    const wrap = $('#review-time-wrap');
    const time = $('#review-time');
    if (wrap) wrap.hidden = !isSchedule;
    if (time) time.required = isSchedule;
  }

  function openApprovalDialog() {
    const draft = currentDraft();
    const reviewer = $('#decision-reviewer')?.value.trim() || '';
    if (!draft) return;
    if (!$('#review-attest')?.checked) { toast('Confirm you reviewed the media and full caption first.', true); return; }
    if (!approvalCanBeReviewed(draft).ok) { toast(approvalCanBeReviewed(draft).note, true); return; }
    const accountField = $('#review-account');
    if (!accountField?.value) { toast('Choose a connected account before approval.', true); return; }
    const dialog = $('#approval-dialog');
    const video = isReel(draft) ? reelAsset(draft) : null;
    const mediaReceipt = video
      ? `<video class="receipt-video" controls preload="metadata" src="${esc(assetUrl(video))}" aria-label="Exact video media: ${esc(draft.title)}"></video><p class="media-disclosure"><b>${esc(draft.mediaDisclosure || 'Concept storyboard')}</b></p>`
      : (draft.slides || []).map((slide, index) => `<img src="${esc(assetUrl(slideAsset(draft, index, slide)))}" alt="Slide ${index + 1}: ${esc(slide.headline)}">`).join('');
    $('#approval-receipt').innerHTML = `<div class="receipt-slides">${mediaReceipt}</div><div class="receipt-copy"><b>${esc(draft.title)} · r${esc(draft.revision)}</b><p class="hash">SHA-256 · ${esc(draft.contentSha256)}</p><h4>Full caption</h4><p>${esc(draft.caption)}</p><h4>Hashtags</h4><p>${esc((draft.hashtags || []).join(' ') || 'None supplied')}</p><h4>Call to action</h4><p>${esc(draft.cta || 'None supplied')}</p>${video ? `<h4>Media purpose</h4><p>${esc(draft.mediaPurpose || 'concept_storyboard')}</p>` : ''}<p><b>Reviewer:</b> ${esc(reviewer || 'Enter below')}</p></div>`;
    const platform = $('#review-platform').value;
    const accountId = accountField.value.split(':').slice(1).join(':');
    const account = state.accounts.find(item => item.id === accountId && item.platform === platform);
    $('#approval-platform').innerHTML = `<option value="${esc(platform)}">${esc(platform)}</option>`;
    $('#approval-account').innerHTML = account ? `<option value="${esc(account.id)}">${esc(account.name)}</option>` : '<option value="">No account</option>';
    $('#approval-action').value = $('#review-action').value;
    $('#approval-time').value = $('#review-time')?.value || '';
    $('#approval-time').required = $('#approval-action').value === 'schedule';
    $('#scheduled-at-field').hidden = $('#approval-action').value !== 'schedule';
    $('#approval-time-label').textContent = `Scheduled time · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'}`;
    $('#approval-approver').value = reviewer;
    $('#approval-attest').checked = false;
    dialog.dataset.draftId = draft.id;
    dialog.dataset.accountId = account?.id || '';
    dialog.dataset.platform = platform;
    dialog.dataset.revision = String(draft.revision);
    dialog.dataset.hash = draft.contentSha256;
    dialog.showModal();
  }

  async function submitApproval(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const dialog = $('#approval-dialog');
    const draft = draftById(dialog.dataset.draftId);
    if (!draft) { toast('Draft changed; reload and review again.', true); return; }
    const action = $('#approval-action').value;
    const localTime = $('#approval-time').value;
    const scheduledAt = action === 'schedule' && localTime ? new Date(localTime).toISOString() : null;
    if (action === 'schedule' && (!scheduledAt || new Date(scheduledAt) <= new Date())) { toast('Choose a future time for this schedule approval.', true); return; }
    if (!$('#approval-attest').checked) { toast('Confirm the exact media and copy before saving approval.', true); return; }
    const platform = dialog.dataset.platform;
    const accountId = dialog.dataset.accountId;
    const current = draftById(dialog.dataset.draftId);
    if (current.revision !== Number(dialog.dataset.revision) || current.contentSha256 !== dialog.dataset.hash) { toast('This draft changed after the receipt opened. Close it and review the new revision.', true); return; }
    const payload = {
      draftId: current.id, revision: Number(dialog.dataset.revision), contentSha256: dialog.dataset.hash,
      target: { platform, accountId }, action, scheduledAt, approver: $('#approval-approver').value.trim()
    };
    if (!payload.approver) { toast('Enter the person approving this exact revision.', true); return; }
    try {
      setBusy(form, true);
      await request('/api/approvals', { method: 'POST', body: JSON.stringify(payload) });
      dialog.close();
      await refreshAll({ quiet: true });
      state.detailTab = 'review'; renderDrafts();
      toast('Approval record saved. No post was published or sent to Meta.');
    } catch (error) {
      toast(`Approval was not recorded: ${errorMessage(error)}`, true);
    } finally { setBusy(form, false); }
  }

  async function regenerate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const freeTemplate = state.provider?.provider === 'template';
    if (!state.provider?.enabled || !state.provider?.provider || !state.provider?.model || (!freeTemplate && !(state.provider.budgetUsd > 0))) {
      toast('No explicitly configured provider/model and positive spend cap are available.', true); return;
    }
    const formData = new FormData(form);
    if (!formData.get('confirm')) { toast('Confirm the model call before regenerating.', true); return; }
    const draftId = String(formData.get('draftId') || '');
    const draft = draftById(draftId);
    const prompt = String(formData.get('prompt') || '').trim();
    if (!draft || !prompt) { toast('Choose a draft and enter a focused prompt.', true); return; }
    const remaining = Number(state.provider.budgetUsd) - Number(state.provider.spentUsd || 0);
    if (!freeTemplate && remaining <= 0) { toast('The configured provider budget is exhausted.', true); return; }
    const providerAction = state.provider.provider === 'template'
      ? 'This runs the local template. No external or paid model call is made.'
      : `This sends the prompt to the configured model. The server-side spend cap is $${Number(state.provider.budgetUsd).toFixed(2)} with $${remaining.toFixed(2)} remaining.`;
    if (!window.confirm(`Generate a new revision of “${draft.title}” using ${state.provider.provider} / ${state.provider.model}?\n\n${providerAction}\nThe result remains unapproved.`)) return;
    try {
      setBusy(form, true);
      const result = await request(`/api/drafts/${encodeURIComponent(draft.id)}/regenerate`, { method: 'POST', body: JSON.stringify({ expectedRevision: draft.revision, expectedContentSha256: draft.contentSha256, prompt }) });
      const created = result.draft || result;
      await refreshAll({ quiet: true });
      state.selectedId = created.id || draft.id;
      await loadDraft(state.selectedId, { quiet: true });
      toast('Generated a new draft revision. It has not been approved.');
      renderDrafts();
      showView('drafts');
    } catch (error) {
      toast(`Regeneration was not run: ${errorMessage(error)}`, true);
    } finally { setBusy(form, false); }
  }

  function bindGlobalEvents() {
    document.addEventListener('error', event => {
      if (event.target instanceof HTMLImageElement && event.target.classList.contains('queue-thumb')) {
        const fallback = document.createElement('span');
        fallback.className = 'queue-thumb reel-thumb';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = 'MEDIA';
        event.target.replaceWith(fallback);
      }
    }, true);
    document.addEventListener('click', async event => {
      const nav = event.target.closest('[data-view]');
      if (nav) { showView(nav.dataset.view); return; }
      const open = event.target.closest('[data-open-draft]');
      if (open) {
        const id = open.dataset.openDraft;
        state.selectedId = id;
        state.listFilter = 'all';
        await loadDraft(id);
        state.detailTab = 'media';
        showView('drafts');
        return;
      }
      const select = event.target.closest('[data-select-draft]');
      if (select) {
        state.selectedId = select.dataset.selectDraft;
        await loadDraft(state.selectedId);
        state.detailTab = 'media';
        renderDrafts();
        return;
      }
      const filter = event.target.closest('[data-filter]');
      if (filter) { state.listFilter = filter.dataset.filter; renderDrafts(); return; }
      const tab = event.target.closest('[data-detail-tab]');
      if (tab) { state.detailTab = tab.dataset.detailTab; renderDrafts(); return; }
      if (event.target.closest('[data-connect-meta]')) { startMetaConnect(); return; }
      if (event.target.closest('[data-disconnect-meta]')) { await disconnectMeta(); return; }
      const execute = event.target.closest('[data-execute]');
      if (execute) { await executeApproval(execute.dataset.execute); return; }
      const revoke = event.target.closest('[data-revoke]');
      if (revoke) await revokeApproval(revoke.dataset.revoke);
      const resolveUnknown = event.target.closest('[data-resolve-unknown]');
      if (resolveUnknown) { await resolveUnknownAttempt(resolveUnknown.dataset.resolveUnknown, resolveUnknown.dataset.approvalId); return; }
      if (event.target.closest('[data-refresh-provider]')) {
        const result = await fetchOptional('/api/provider', 'Provider');
        state.provider = result.data;
        if (result.error) toast(result.error, true); else toast('Provider status refreshed.');
        renderIdeas();
      }
    });
    $('#refresh-button')?.addEventListener('click', () => refreshAll());
    $('#menu-toggle')?.addEventListener('click', () => $('.sidebar').classList.toggle('open'));
    $('#approval-action')?.addEventListener('change', updateApprovalDialogTime);
    $('#approval-form')?.addEventListener('submit', submitApproval);
    document.addEventListener('submit', event => { if (event.target.id === 'idea-form') regenerate(event); }, true);
  }

  function updateApprovalDialogTime() {
    const schedule = $('#approval-action').value === 'schedule';
    $('#scheduled-at-field').hidden = !schedule;
    $('#approval-time').required = schedule;
  }

  async function revokeApproval(id) {
    const approval = state.approvals.find(item => item.id === id);
    const reason = window.prompt(`Reason for revoking approval ${id}?`);
    if (!reason?.trim()) return;
    if (!window.confirm(`Revoke ${approval?.draftId || 'this'} approval? It cannot be revoked after execution begins.`)) return;
    try {
      await request(`/api/approvals/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      await refreshAll({ quiet: true });
      toast('Approval revocation recorded.');
    } catch (error) { toast(`Could not revoke approval: ${errorMessage(error)}`, true); }
  }

  async function resolveUnknownAttempt(attemptId, approvalId) {
    const approval = state.approvals.find(item => item.id === approvalId);
    const reviewer = window.prompt('Who verified the external outcome?');
    if (!reviewer?.trim()) return;
    const resolution = window.prompt('After checking the destination, enter exactly confirmed_published or confirmed_not_published.');
    if (!['confirmed_published', 'confirmed_not_published'].includes(resolution)) { toast('No resolution recorded. Use one of the two exact values after checking the destination.', true); return; }
    const note = window.prompt('Record what you checked (required for the audit).');
    if (!note?.trim()) return;
    const summary = `Resolve uncertain publish outcome?\n\n${approval?.draftId || 'Draft'} · ${approval?.target?.platform || 'platform'} · ${approval?.target?.accountId || 'account'}\n${approval?.contentSha256 || 'No hash available'}\nOutcome: ${resolution}\nReviewer: ${reviewer.trim()}\n\nThis records a human reconciliation only. It will not retry the post.`;
    if (!window.confirm(summary)) return;
    try {
      await request(`/api/attempts/${encodeURIComponent(attemptId)}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, reviewer: reviewer.trim(), note: note.trim() }) });
      await refreshAll({ quiet: true });
      toast('Human reconciliation recorded. No external action was retried.');
    } catch (error) { toast(`Could not record resolution: ${errorMessage(error)}`, true); }
  }

  function startMetaConnect() {
    if (!state.status?.oauthReady) { toast('Meta OAuth is not configured on the local server.', true); return; }
    if (state.accounts.some(account => account.connected)) { toast('A Meta account is already connected. Disconnect first if you need to change it.', true); return; }
    // Recheck local configuration first. OAuth starts only in response to this user's click.
    request('/api/status').then(result => {
      state.status = result.status || result;
      updatePublishState();
      if (state.status.connected) { toast('A Meta account is already connected. Refreshing the account list.'); refreshAll({ quiet: true }); return; }
      if (!state.status.oauthReady) { toast('Meta OAuth is not configured on the local server.', true); return; }
      window.location.assign('/api/meta/oauth/start');
    }).catch(error => toast(`Could not verify Meta connection setup: ${errorMessage(error)}`, true));
  }

  async function disconnectMeta() {
    const connected = state.accounts.filter(account => account.connected);
    if (!connected.length) { toast('There is no connected Meta account to disconnect.'); return; }
    const names = connected.map(account => `${account.platform} · ${account.name}`).join('\n');
    if (!window.confirm(`Disconnect the local Meta connection?\n\n${names}\n\nThis removes encrypted tokens and linked account records from this local app. It does not delete or change any Meta account or Page.`)) return;
    try {
      await request('/api/meta/disconnect', { method: 'POST', body: JSON.stringify({}) });
      state.draftDetails.clear();
      await refreshAll({ quiet: true });
      toast('Local Meta connection removed. No Page or account was deleted.');
    } catch (error) { toast(`Disconnect did not complete: ${errorMessage(error)}`, true); }
  }

  async function executeApproval(id) {
    try {
      const [statusData, approvalsData, accountsData] = await Promise.all([
        request('/api/status'), request('/api/approvals'), request('/api/accounts')
      ]);
      state.status = statusData.status || statusData;
      state.approvals = Array.isArray(approvalsData.approvals) ? approvalsData.approvals : [];
      state.accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
      updatePublishState();
    } catch (error) {
      toast(`Could not refresh execution safeguards: ${errorMessage(error)}`, true);
      return;
    }
    const approval = state.approvals.find(item => item.id === id);
    if (!state.status?.publishingEnabled) { toast('Execution is disabled by YARD_META_PUBLISH_ENABLED=false.', true); return; }
    if (!approval || approval.status !== 'approved' || approval.action !== 'publish_now') {
      toast('Only an existing approved “publish now” record can be executed here. Scheduled approvals run at their approved time.', true);
      return;
    }
    const draft = await loadDraft(approval.draftId, { quiet: true });
    if (!draft || draft.revision !== approval.revision || draft.contentSha256 !== approval.contentSha256) {
      toast('The approved revision or media hash no longer matches. Execution is blocked; review the current draft.', true);
      return;
    }
    const account = state.accounts.find(item => item.connected && item.id === approval.target?.accountId && item.platform === approval.target?.platform);
    if (!account) { toast('The exact approved account is not connected. Execution is blocked.', true); return; }
    const assets = (approval.assetHashes || []).map(item => `${item.name} · ${item.sha256}`).join('\n');
    const summary = [
      'Execute this existing human approval now?',
      '',
      `Draft: ${draft.title} (${draft.id})`,
      `Platform: ${approval.target.platform}`,
      `Account: ${approval.target.accountName || account.name} · ${approval.target.accountId}`,
      'Action: publish now',
      `Approved at: ${fmtDate(approval.approvedAt || approval.createdAt)}`,
      'Scheduled time: none',
      `Approved by: ${approval.approver}`,
      `Revision: ${approval.revision}`,
      `Content SHA-256: ${approval.contentSha256}`,
      `Approved caption:\n${draft.caption || '(none)'}`,
      `Hashtags: ${(draft.hashtags || []).join(' ') || '(none)'}`,
      `Call to action: ${draft.cta || '(none)'}`,
      draft.mediaDisclosure ? `Media disclosure: ${draft.mediaDisclosure}` : '',
      `Media SHA-256:\n${assets || 'Verified by the server'}`,
      '',
      'Continuing sends this exact approved media and caption to the connected Meta account. External publication cannot be undone here.'
    ].join('\n');
    if (!window.confirm(summary)) return;
    try {
      await request(`/api/approvals/${encodeURIComponent(approval.id)}/execute`, { method: 'POST', body: JSON.stringify({}) });
      await refreshAll({ quiet: true });
      toast('The server reported this approved action completed. Review History for its recorded outcome.');
    } catch (error) {
      await refreshAll({ quiet: true });
      toast(`Execution did not complete: ${errorMessage(error)}. Check History before taking any further action.`, true);
    }
  }

  function bindDynamic() {
    $('#view-calendar')?.addEventListener('click', event => {
      const button = event.target.closest('[data-open-draft]');
      if (button) showView('drafts');
    });
  }

  bindGlobalEvents();
  bindDynamic();
  refreshAll();
})();
