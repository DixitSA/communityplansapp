import type { MyProfile } from '@/lib/api';

import { draftFromProfile, isChanged, isDraftValid, toInput } from '../editProfile';

const interest = (id: number) => ({ id, slug: `s${id}`, label: `L${id}`, symbol: 'star' });
const me: MyProfile = {
  id: 'u1',
  username: 'maya',
  displayName: 'Maya',
  homeCityId: 1,
  bio: null,
  interests: [interest(1), interest(2), interest(3)],
};

describe('edit profile draft', () => {
  it('starts unchanged and valid', () => {
    const d = draftFromProfile(me);
    expect(isChanged(d, me)).toBe(false);
    expect(isDraftValid(d)).toBe(true);
  });

  it('notices edits, ignoring interest order and surrounding spaces', () => {
    const d = draftFromProfile(me);
    expect(isChanged({ ...d, interestIds: [3, 2, 1], displayName: ' Maya ' }, me)).toBe(false);
    expect(isChanged({ ...d, bio: 'hi' }, me)).toBe(true);
    expect(isChanged({ ...d, interestIds: [1, 2, 4] }, me)).toBe(true);
  });

  it('rejects bad values', () => {
    const d = draftFromProfile(me);
    expect(isDraftValid({ ...d, displayName: '  ' })).toBe(false);
    expect(isDraftValid({ ...d, username: 'a' })).toBe(false);
    expect(isDraftValid({ ...d, bio: 'x'.repeat(161) })).toBe(false);
    expect(isDraftValid({ ...d, interestIds: [1, 2] })).toBe(false);
  });

  it('builds a trimmed input', () => {
    expect(toInput({ ...draftFromProfile(me), displayName: ' Maya R ', bio: ' hey ' })).toMatchObject({
      displayName: 'Maya R',
      bio: 'hey',
    });
  });
});
