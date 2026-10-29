import { friendButtonA11y, friendButtonSpec } from '../components/FriendButton';

describe('friendButtonSpec', () => {
  it('labels every state and marks Add and Accept as the primary action', () => {
    expect(friendButtonSpec('none')).toMatchObject({ label: 'Add friend', tone: 'primary', action: 'add' });
    expect(friendButtonSpec('outgoing')).toMatchObject({ label: 'Requested', tone: 'muted', action: 'cancel' });
    expect(friendButtonSpec('incoming')).toMatchObject({ label: 'Accept', tone: 'primary', action: 'accept' });
    expect(friendButtonSpec('friends')).toMatchObject({ label: 'Friends', tone: 'muted', action: 'friends' });
  });

  it('shortens Add in list rows and drops the menu chevron', () => {
    expect(friendButtonSpec('none', 'compact').label).toBe('Add');
    expect(friendButtonSpec('friends', 'compact').trailingSymbol).toBeUndefined();
    expect(friendButtonSpec('friends', 'regular').trailingSymbol).toBe('chevron.down');
  });
});

describe('friendButtonA11y', () => {
  it('names the person and explains what a tap does', () => {
    expect(friendButtonA11y('none', 'Maya').label).toBe('Add Maya as a friend');
    expect(friendButtonA11y('outgoing', 'Maya').hint).toMatch(/cancel/);
    expect(friendButtonA11y('friends', 'Maya').hint).toMatch(/options/);
  });
});
