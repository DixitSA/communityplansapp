import type { BlockedPerson } from '@/lib/api';

import { withoutBlocked } from '../blockedList';

const person = (id: string): BlockedPerson => ({ id, username: id, displayName: id, avatarUrl: null, blockedAt: new Date('2026-11-01T00:00:00Z') });

describe('withoutBlocked', () => {
  it('removes only the unblocked person', () => {
    expect(withoutBlocked([person('a'), person('b')], 'a').map((p) => p.id)).toEqual(['b']);
  });
  it('leaves the list alone for an unknown id', () => {
    expect(withoutBlocked([person('a')], 'z')).toHaveLength(1);
  });
});
