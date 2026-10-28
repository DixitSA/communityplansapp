import * as Crypto from 'expo-crypto';

/** Lowercase hex for a list of bytes. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A fresh nonce for Sign in with Apple. Apple signs the SHA-256 `hashed` value into the identity
 * token; Supabase receives the `raw` value and hashes it itself to check they match.
 */
export async function createAppleNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = bytesToHex(Crypto.getRandomBytes(32));
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}
