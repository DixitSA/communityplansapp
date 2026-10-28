/** Small stable string hash (FNV-1a, 32-bit). Same input always gives the same number. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic number in [0, 1) from a string and a salt, so one id can drive several values. */
export function unitFrom(s: string, salt = ''): number {
  return hashString(`${s}:${salt}`) / 4294967296;
}
