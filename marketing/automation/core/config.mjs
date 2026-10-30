import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKey } from './crypto-vault.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function bool(value) {
  return value === 'true';
}

export function readConfig(env = process.env, overrides = {}) {
  const currentKey = parseKey(env.YARD_META_TOKEN_KEY, env.YARD_META_TOKEN_KEY_ID || 'current');
  const previousKey = parseKey(env.YARD_META_TOKEN_KEY_PREVIOUS, env.YARD_META_TOKEN_KEY_PREVIOUS_ID || 'previous');
  const scopes = (env.YARD_META_SCOPES || '').split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean);
  const provider = env.YARD_TEXT_PROVIDER || 'none';
  const model = env.YARD_TEXT_MODEL || '';
  const budgetUsd = Number(env.YARD_TEXT_MONTHLY_BUDGET_USD || 0);
  const inputUsdPerMillion = Number(env.YARD_TEXT_INPUT_USD_PER_MILLION || 0);
  const outputUsdPerMillion = Number(env.YARD_TEXT_OUTPUT_USD_PER_MILLION || 0);
  const maxOutputTokens = Number(env.YARD_TEXT_MAX_OUTPUT_TOKENS || 700);
  const appId = env.YARD_META_APP_ID || '';
  const appSecret = env.YARD_META_APP_SECRET || '';
  const graphVersion = env.YARD_META_GRAPH_VERSION || 'v26.0';
  const redirectUri = env.YARD_META_REDIRECT_URI || 'http://127.0.0.1:4317/oauth/meta/callback';
  const port = Number(env.YARD_PORT || 4317);
  if (!Number.isInteger(port) || port !== 4317) throw new Error('YARD_PORT must be 4317.');
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('YARD_META_GRAPH_VERSION must look like v26.0.');
  if (provider !== 'none' && provider !== 'template' && provider !== 'openai') throw new Error('Unsupported YARD_TEXT_PROVIDER.');
  if (!Number.isFinite(budgetUsd) || budgetUsd < 0) throw new Error('YARD_TEXT_MONTHLY_BUDGET_USD must be non-negative.');
  if (![inputUsdPerMillion, outputUsdPerMillion].every((value) => Number.isFinite(value) && value >= 0)) throw new Error('Text provider rates must be non-negative numbers.');
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 4000) throw new Error('YARD_TEXT_MAX_OUTPUT_TOKENS must be between 1 and 4000.');

  const pkceEnabled = bool(env.YARD_META_PKCE_ENABLED);
  const oauthReady = Boolean(appId && appSecret && graphVersion && scopes.length && currentKey && redirectUri === 'http://127.0.0.1:4317/oauth/meta/callback');
  let mediaBaseUrlValid = false;
  try {
    const mediaUrl = new URL(env.YARD_META_MEDIA_BASE_URL || '');
    mediaBaseUrlValid = mediaUrl.protocol === 'https:' && Boolean(mediaUrl.hostname) && !mediaUrl.username && !mediaUrl.password;
  } catch { mediaBaseUrlValid = false; }
  const publisherConfigured = bool(env.YARD_META_PUBLISH_ENABLED) && oauthReady && mediaBaseUrlValid;
  const providerReady = provider === 'template' || (provider === 'openai' && model && env.YARD_TEXT_API_KEY && budgetUsd > 0 && inputUsdPerMillion > 0 && outputUsdPerMillion > 0);

  return {
    host: '127.0.0.1',
    port,
    root,
    statePath: resolve(root, '.data', 'state.json'),
    uploadDir: resolve(root, '.data', 'uploads'),
    publicDir: resolve(root, 'public'),
    contentPath: resolve(root, '..', 'content', 'launch-drafts.json'),
    mediaDir: resolve(root, '..', 'preview', 'media'),
    jpegMediaDir: resolve(root, '..', 'preview', 'media', 'jpeg'),
    reelsDir: resolve(root, '..', 'reels'),
    graphVersion,
    redirectUri,
    appId,
    appSecret,
    scopes,
    oauthReady,
    pkceEnabled,
    tokenKey: currentKey,
    previousTokenKey: previousKey,
    publishingEnabled: publisherConfigured,
    mediaBaseUrl: env.YARD_META_MEDIA_BASE_URL || '',
    provider,
    model,
    providerApiKey: env.YARD_TEXT_API_KEY || '',
    providerBudgetUsd: budgetUsd,
    providerInputUsdPerMillion: inputUsdPerMillion,
    providerOutputUsdPerMillion: outputUsdPerMillion,
    providerMaxOutputTokens: maxOutputTokens,
    providerEnabled: providerReady,
    providerPeriod: new Date().toISOString().slice(0, 7),
    ...overrides,
  };
}
