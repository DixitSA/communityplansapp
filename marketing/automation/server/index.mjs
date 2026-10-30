import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../core/config.mjs';
import { JsonStore } from '../core/store.mjs';
import { TokenVault } from '../core/crypto-vault.mjs';
import { DraftService } from '../core/drafts.mjs';
import { MetaClient } from '../core/meta-client.mjs';
import { OAuthFlow } from '../core/oauth.mjs';
import { ApprovalService } from '../core/approvals.mjs';
import { TextProvider } from '../core/provider.mjs';
import { DiscoveryService } from '../core/discovery.mjs';
import { EventReviewService } from '../core/event-review.mjs';
import { AppError, publicError } from '../core/errors.mjs';

const config = readConfig();
const store = new JsonStore(config.statePath);
const vault = new TokenVault({ current: config.tokenKey, previous: config.previousTokenKey });
const meta = new MetaClient({ config });
const drafts = new DraftService({ store, contentPath: config.contentPath, mediaDir: config.mediaDir, jpegMediaDir: config.jpegMediaDir, reelsDir: config.reelsDir });
const oauth = new OAuthFlow({ config, meta, store, vault });
const approvals = new ApprovalService({ config, store, drafts, oauth, meta });
const provider = new TextProvider({ config, store });
const discovery = new DiscoveryService({ store, oauth, meta });
const eventReview = new EventReviewService({ store });

function json(res, status, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(bytes);
}

function requestHost(req) {
  const host = String(req.headers.host || '').toLowerCase();
  return host === '127.0.0.1:4317' || host === 'localhost:4317';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.port === '4317' && parsed.protocol === 'http:';
  } catch { return false; }
}

async function bodyJson(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new AppError('request_too_large', 'Request body is too large.', 413);
    chunks.push(chunk);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError('invalid_request', 'Request body must be valid JSON.'); }
}

function statusView(accounts, discoveryStatus, hashtagStatus) {
  return { server: { bind: config.host, port: config.port }, publishingEnabled: config.publishingEnabled, connected: accounts.length > 0, accounts: accounts.length, oauthReady: config.oauthReady, discovery: { ...discoveryStatus, hashtagSearch: hashtagStatus }, pendingApprovals: 0 };
}

async function staticFile(pathname, res) {
  const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const publicRoot = resolve(config.publicDir);
  const path = resolve(publicRoot, `.${decoded}`);
  if (!path.startsWith(`${publicRoot}\\`) && !path.startsWith(`${publicRoot}/`)) throw new AppError('not_found', 'File not found.', 404);
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new AppError('not_found', 'File not found.', 404);
  const mime = ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream';
  const bytes = await readFile(path);
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
  res.end(bytes);
}

async function handle(req, res) {
  const requestId = randomUUID();
  if (!requestHost(req)) return json(res, 403, { error: { code: 'loopback_only', message: 'Use the local dashboard address.', requestId } });
  if (!sameOrigin(req)) return json(res, 403, { error: { code: 'origin_rejected', message: 'Request origin is not allowed.', requestId } });
  const url = new URL(req.url, 'http://127.0.0.1:4317');
  try {
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      const name = decodeURIComponent(url.pathname.slice('/media/'.length));
      const bytes = await drafts.readPublicMedia(name);
      const type = name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg' : name.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" }); res.end(bytes); return;
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/oauth/meta/callback') {
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const state = await store.read(); const discoveryStatus = await discovery.readiness(); const hashtagStatus = await discovery.hashtagReadiness();
        return json(res, 200, { status: { ...statusView(state.accounts, discoveryStatus, hashtagStatus), pendingApprovals: state.approvals.filter((item) => item.status === 'approved').length } });
      }
      if (req.method === 'GET' && url.pathname === '/api/drafts') return json(res, 200, { drafts: await drafts.list() });
      const getDraft = url.pathname.match(/^\/api\/drafts\/([^/]+)$/);
      if (req.method === 'GET' && getDraft) return json(res, 200, { draft: await drafts.get(decodeURIComponent(getDraft[1])) });
      if (req.method === 'GET' && url.pathname === '/api/calendar') return json(res, 200, { calendar: await drafts.calendar() });
      if (req.method === 'GET' && url.pathname === '/api/accounts') return json(res, 200, { accounts: (await store.read()).accounts });
      if (req.method === 'GET' && url.pathname === '/api/approvals') return json(res, 200, { approvals: (await store.read()).approvals });
      if (req.method === 'GET' && url.pathname === '/api/activity') return json(res, 200, { items: (await store.read()).activity });
      if (req.method === 'GET' && url.pathname === '/api/provider') return json(res, 200, await provider.status());
      if (req.method === 'GET' && url.pathname === '/api/discovery/candidates') return json(res, 200, { candidates: await discovery.listCandidates() });
      if (req.method === 'GET' && url.pathname === '/api/discovery/leads') return json(res, 200, { leads: await discovery.listLeads() });
      if (req.method === 'GET' && url.pathname === '/api/discovery/quota') return json(res, 200, { quota: await discovery.hashtagQuota() });
      if (req.method === 'GET' && url.pathname === '/api/event-review/status') return json(res, 200, await eventReview.status());
      if (req.method === 'GET' && url.pathname === '/api/event-review/drafts') return json(res, 200, { drafts: await eventReview.list() });
      if (req.method === 'GET' && url.pathname === '/api/event-review/export') return json(res, 200, await eventReview.export());
      const eventDraft = url.pathname.match(/^\/api\/event-review\/drafts\/([^/]+)$/);
      if (req.method === 'GET' && eventDraft) return json(res, 200, { draft: await eventReview.get(decodeURIComponent(eventDraft[1])) });
      if (req.method === 'GET' && url.pathname === '/api/insights') throw new AppError('insights_not_implemented', 'Insights are not implemented until metric permissions are verified.', 501);
      if (req.method === 'GET' && url.pathname === '/api/meta/oauth/start') {
        const target = oauth.start(); res.writeHead(302, { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); return;
      }
      if (req.method === 'GET' && url.pathname === '/oauth/meta/callback') {
        const accounts = await oauth.finish({ state: url.searchParams.get('state'), code: url.searchParams.get('code'), error: url.searchParams.get('error') });
        res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); return;
      }
      if (req.method !== 'GET' && !['application/json', 'application/json; charset=utf-8'].includes(String(req.headers['content-type'] || '').toLowerCase())) throw new AppError('invalid_request', 'Send a JSON request body.', 415);
      const input = req.method === 'GET' ? {} : await bodyJson(req);
      if (req.method === 'PUT' && /^\/api\/drafts\/[^/]+$/.test(url.pathname)) {
        const id = decodeURIComponent(url.pathname.split('/').at(-1)); return json(res, 200, { draft: await drafts.update(id, input) });
      }
      const decision = url.pathname.match(/^\/api\/drafts\/([^/]+)\/decision$/);
      if (req.method === 'POST' && decision) return json(res, 201, { decision: await drafts.recordDecision(decodeURIComponent(decision[1]), input) });
      const regen = url.pathname.match(/^\/api\/drafts\/([^/]+)\/regenerate$/);
      if (req.method === 'POST' && regen) {
        const id = decodeURIComponent(regen[1]); const current = await drafts.get(id);
        if (current.revision !== input.expectedRevision || current.contentSha256 !== input.expectedContentSha256) throw new AppError('revision_conflict', 'Draft changed. Reload before regenerating.', 409);
        const generated = await provider.regenerate(current, input.prompt);
        const updated = await drafts.update(id, { expectedRevision: current.revision, expectedContentSha256: current.contentSha256, caption: generated.caption });
        await store.transaction((state) => state.activity.unshift({ id: randomUUID(), type: 'draft_regenerated', at: new Date().toISOString(), draftId: id, revision: updated.revision, provider: generated.generatedBy, estimatedCostUsd: generated.estimatedCostUsd }));
        return json(res, 200, { draft: updated, provider: generated.generatedBy, estimatedCostUsd: generated.estimatedCostUsd });
      }
      if (req.method === 'POST' && url.pathname === '/api/approvals') return json(res, 201, { approval: await approvals.create(input) });
      if (req.method === 'POST' && url.pathname === '/api/discovery/instagram/collect') return json(res, 201, await discovery.collect(input));
      if (req.method === 'POST' && url.pathname === '/api/discovery/following/import') return json(res, 201, await discovery.importFollowing(input));
      if (req.method === 'POST' && url.pathname === '/api/discovery/instagram/hashtag/collect') return json(res, 201, await discovery.collectHashtag(input));
      if (req.method === 'POST' && url.pathname === '/api/event-review/drafts') return json(res, 201, { draft: await eventReview.create(input) });
      if (req.method === 'PUT' && eventDraft) return json(res, 200, { draft: await eventReview.update(decodeURIComponent(eventDraft[1]), input) });
      const eventReject = url.pathname.match(/^\/api\/event-review\/drafts\/([^/]+)\/reject$/);
      if (req.method === 'POST' && eventReject) return json(res, 200, { draft: await eventReview.reject(decodeURIComponent(eventReject[1]), input) });
      const revoke = url.pathname.match(/^\/api\/approvals\/([^/]+)\/revoke$/);
      if (req.method === 'POST' && revoke) return json(res, 200, { approval: await approvals.revoke(decodeURIComponent(revoke[1]), input.reason) });
      const execute = url.pathname.match(/^\/api\/approvals\/([^/]+)\/execute$/);
      if (req.method === 'POST' && execute) return json(res, 200, await approvals.execute(decodeURIComponent(execute[1])));
      const resolveUnknown = url.pathname.match(/^\/api\/attempts\/([^/]+)\/resolve$/);
      if (req.method === 'POST' && resolveUnknown) return json(res, 200, { attempt: await approvals.resolveUnknown(decodeURIComponent(resolveUnknown[1]), input) });
      if (req.method === 'POST' && url.pathname === '/api/meta/disconnect') { await oauth.disconnect(); return json(res, 200, { disconnected: true }); }
      if (req.method === 'POST' && url.pathname === '/api/meta/refresh') return json(res, 200, await oauth.refresh());
      throw new AppError('not_found', 'API route not found.', 404);
    }
    if (req.method !== 'GET') throw new AppError('not_found', 'Route not found.', 404);
    await staticFile(url.pathname, res);
  } catch (error) {
    const exposed = publicError(error);
    json(res, exposed.status, { ...exposed.body, error: { ...exposed.body.error, requestId } });
  }
}

await store.initialize();
await drafts.initialize();
await approvals.recoverInFlight();
const server = http.createServer((req, res) => { void handle(req, res); });
server.listen(config.port, config.host, () => console.log(`Yard local marketing dashboard listening on http://${config.host}:${config.port}`));
const scheduler = setInterval(() => { if (config.publishingEnabled) void approvals.runDueSchedules(); }, 5000);
scheduler.unref();

export { handle, server, config, store, drafts, approvals, oauth, discovery, eventReview };
