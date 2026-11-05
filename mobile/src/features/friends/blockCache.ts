import type { QueryClient } from '@tanstack/react-query';

/** Refresh every screen whose data can change when a block is added or removed. */
export function invalidateBlockSensitiveQueries(client: QueryClient) {
  for (const queryKey of [
    ['blocked-users'],
    ['friends'],
    ['feed'],
    ['event'],
    ['chats'],
    ['chat'],
    ['my-profile'],
  ]) {
    void client.invalidateQueries({ queryKey });
  }
}
