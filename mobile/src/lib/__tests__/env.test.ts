import { hasBackendConfig } from '../env';

describe('hasBackendConfig', () => {
  it('needs both values', () => {
    expect(hasBackendConfig('https://x.supabase.co', 'anon')).toBe(true);
    expect(hasBackendConfig('https://x.supabase.co', undefined)).toBe(false);
    expect(hasBackendConfig(undefined, 'anon')).toBe(false);
    expect(hasBackendConfig('', 'anon')).toBe(false);
    expect(hasBackendConfig('  ', '  ')).toBe(false);
  });
});
