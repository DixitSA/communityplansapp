import { QueryClient } from '@tanstack/react-query';

import { invalidateBlockSensitiveQueries } from '../blockCache';

it('invalidates all cached views affected by a block change, including per-chat and per-user keys', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const keys = [
      ['blocked-users', 'u1'],
      ['friends', 'list'],
      ['friends', 'profile', 'u2'],
      ['feed', 1, '2026-11-04'],
      ['event', 'e1'],
      ['chats', 'e1,e2'],
      ['chat', 'e1'],
      ['chat', 'e2'],
      ['my-profile', 'u1'],
    ] as const;
    for (const key of keys) client.setQueryData(key, { cached: true });
    client.setQueryData(['settings', 'theme'], { cached: true });

    invalidateBlockSensitiveQueries(client);

    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(['settings', 'theme'])?.isInvalidated).toBe(false);
  } finally {
    client.clear();
  }
});
