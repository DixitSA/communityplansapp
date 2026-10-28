import { bytesToHex, createAppleNonce } from '../nonce';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => i * 7),
  digestStringAsync: async (algorithm: string, data: string) => `${algorithm}(${data})`,
}));

describe('bytesToHex', () => {
  it('pads each byte to two lowercase hex digits', () => {
    expect(bytesToHex(Uint8Array.from([0, 1, 15, 16, 255]))).toBe('00010f10ff');
    expect(bytesToHex(new Uint8Array())).toBe('');
  });
});

describe('createAppleNonce', () => {
  it('returns a 64-character hex raw nonce and its SHA-256 hash', async () => {
    const { raw, hashed } = await createAppleNonce();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).toBe(`SHA-256(${raw})`);
    expect(hashed).not.toBe(raw);
  });
});
