import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppError } from './errors.mjs';

export function parseKey(hex, keyId) {
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new AppError('invalid_token_key', 'Token encryption keys must be 64 hexadecimal characters.', 500);
  return { id: keyId || 'current', bytes: Buffer.from(hex, 'hex') };
}

export class TokenVault {
  constructor({ current, previous = null }) {
    this.keys = new Map();
    if (current) this.keys.set(current.id, current.bytes);
    if (previous) this.keys.set(previous.id, previous.bytes);
    this.current = current;
  }

  get available() {
    return Boolean(this.current);
  }

  encrypt(value) {
    if (!this.current) throw new AppError('token_encryption_unconfigured', 'Token encryption is not configured.', 503);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.current.bytes, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return {
      version: 1,
      keyId: this.current.id,
      iv: iv.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
    };
  }

  decrypt(envelope) {
    if (!envelope || envelope.version !== 1) throw new AppError('token_ciphertext_invalid', 'Stored token data is invalid.', 500);
    const key = this.keys.get(envelope.keyId);
    if (!key) throw new AppError('token_key_missing', 'A key needed to decrypt stored tokens is unavailable.', 503);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
      const clear = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(clear);
    } catch {
      throw new AppError('token_ciphertext_invalid', 'Stored token data could not be decrypted.', 500);
    }
  }
}

export function randomToken() {
  return randomBytes(32).toString('base64url');
}
