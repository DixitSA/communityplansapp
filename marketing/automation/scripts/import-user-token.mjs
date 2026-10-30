import { stdin, stdout, stderr } from 'node:process';
import { readConfig } from '../core/config.mjs';
import { JsonStore } from '../core/store.mjs';
import { TokenVault } from '../core/crypto-vault.mjs';
import { MetaClient } from '../core/meta-client.mjs';
import { OAuthFlow } from '../core/oauth.mjs';
import { AppError } from '../core/errors.mjs';

function pageIdArgument(args) {
  if (args.length !== 2 || args[0] !== '--page-id' || !/^\d{1,32}$/.test(args[1])) {
    throw new AppError('invalid_page_id', 'Usage: npm run import-user-token -- --page-id <exact-yard-page-id>');
  }
  return args[1];
}

async function readPipeToken() {
  const chunks = [];
  let size = 0;
  for await (const chunk of stdin) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 8192) throw new AppError('invalid_user_token', 'Token input is too long.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function readHiddenTerminalToken() {
  stdout.write('Paste the Facebook USER token (input hidden), then press Enter: ');
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  let token = '';
  try {
    return await new Promise((resolve, reject) => {
      const onData = (key) => {
        if (key === '\u0003') { cleanup(); reject(new AppError('input_cancelled', 'Token import cancelled.')); return; }
        if (key === '\r' || key === '\n') { cleanup(); stdout.write('\n'); resolve(token); return; }
        if (key === '\u007f' || key === '\b') { token = token.slice(0, -1); return; }
        if (key >= ' ' && key !== '\u007f') {
          token += key;
          if (Buffer.byteLength(token, 'utf8') > 8192) { cleanup(); reject(new AppError('invalid_user_token', 'Token input is too long.')); }
        }
      };
      const cleanup = () => stdin.off('data', onData);
      stdin.on('data', onData);
    });
  } finally {
    stdin.pause();
    stdin.setRawMode(false);
  }
}

async function main() {
  const pageId = pageIdArgument(process.argv.slice(2));
  if (stdin.isTTY && typeof stdin.setRawMode !== 'function') throw new AppError('hidden_input_unavailable', 'This terminal cannot disable input echo; pipe the token through stdin instead.');
  const config = readConfig();
  if (!config.oauthReady || !config.tokenKey) throw new AppError('oauth_not_configured', 'Configure the Meta app and token-encryption key before importing.');
  let token = stdin.isTTY ? await readHiddenTerminalToken() : await readPipeToken();
  const store = new JsonStore(config.statePath);
  await store.initialize();
  const vault = new TokenVault({ current: config.tokenKey, previous: config.previousTokenKey });
  const meta = new MetaClient({ config });
  const oauth = new OAuthFlow({ config, meta, store, vault });
  let accounts;
  try { accounts = await oauth.importUserToken({ userToken: token, pageId }); }
  finally { token = ''; }
  stdout.write(`Encrypted connection saved for ${accounts.length} account(s) on the selected Page. Token values were not displayed.\n`);
}

main().catch((error) => {
  const code = error instanceof AppError || /^meta_[a-z0-9_-]{1,32}$/i.test(error?.code || '') ? error.code : 'import_failed';
  const message = error instanceof AppError ? error.message : code.startsWith('meta_') ? 'Meta token validation failed; details suppressed.' : 'Token import failed; details suppressed.';
  stderr.write(`${code}: ${message}\n`);
  process.exitCode = 1;
});
