import type { ChatMessage, ChatSummary } from '@/lib/api';

import {
  buildChatItems,
  chatPreview,
  chatSubtitle,
  confirmSent,
  countdownLabel,
  formatSeparator,
  insertMessage,
  isTempId,
  makeTempId,
  makeTempMessage,
  markDeleted,
  messageA11yLabel,
  relativeTime,
  removeMessage,
  sectionChats,
  unreadBadge,
  updateMessage,
} from '../messages';

const at = (h: number, m = 0, day = 29) => new Date(2026, 9, day, h, m);
const NOW = at(21, 0);

const msg = (id: string, userId: string, when: Date, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  userId,
  displayName: userId === 'me' ? 'Taylor' : userId.toUpperCase(),
  avatarPath: null,
  body: `text ${id}`,
  createdAt: when,
  isMine: userId === 'me',
  deleted: false,
  ...over,
});

describe('buildChatItems', () => {
  it('groups consecutive messages from one person and puts the avatar on the first', () => {
    const list = [msg('3', 'maya', at(20, 12)), msg('2', 'maya', at(20, 11)), msg('1', 'jo', at(20, 10))];
    const rows = buildChatItems(list, NOW).filter((i) => i.kind === 'message');
    // newest first
    expect(rows.map((r) => r.key)).toEqual(['3', '2', '1']);
    const byId = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byId['1']).toMatchObject({ startsGroup: true, endsGroup: true });
    expect(byId['2']).toMatchObject({ startsGroup: true, endsGroup: false });
    expect(byId['3']).toMatchObject({ startsGroup: false, endsGroup: true });
  });

  it('splits a group after five minutes', () => {
    const list = [msg('2', 'maya', at(20, 20)), msg('1', 'maya', at(20, 10))];
    const rows = buildChatItems(list, NOW).filter((i) => i.kind === 'message');
    expect(rows.every((r) => r.startsGroup && r.endsGroup)).toBe(true);
  });

  it('adds a separator before the first message, after a long pause and on a new day', () => {
    const list = [
      msg('4', 'maya', at(20, 30)),
      msg('3', 'maya', at(20, 29)),
      msg('2', 'maya', at(14, 0)),
      msg('1', 'maya', at(23, 0, 28)),
    ];
    const items = buildChatItems(list, NOW);
    const seps = items.filter((i) => i.kind === 'separator');
    expect(seps.map((s) => s.kind === 'separator' && s.label)).toEqual([
      'Today 8:29 PM',
      'Today 2:00 PM',
      'Yesterday 11:00 PM',
    ]);
    // A separator sits visually above its message, so it comes after it in the newest-first list.
    expect(items.map((i) => i.key)).toEqual(['4', '3', 'sep:3', '2', 'sep:2', '1', 'sep:1']);
    // A separator also ends a group.
    const two = items.find((i) => i.key === '2');
    expect(two).toMatchObject({ startsGroup: true, endsGroup: true });
  });

  it('returns nothing for an empty chat', () => {
    expect(buildChatItems([], NOW)).toEqual([]);
  });
});

describe('formatSeparator', () => {
  it.each([
    [at(9, 41), 'Today 9:41 AM'],
    [at(21, 5, 28), 'Yesterday 9:05 PM'],
    [at(12, 0, 26), 'Mon 12:00 PM'],
    [at(12, 0, 12), 'Oct 12, 12:00 PM'],
  ])('%s', (date, label) => {
    expect(formatSeparator(date, NOW)).toBe(label);
  });
});

describe('merging live changes', () => {
  it('ignores an insert whose id is already in the list', () => {
    const list = [msg('5', 'maya', at(20))];
    expect(insertMessage(list, msg('5', 'maya', at(20)))).toBe(list);
  });

  it('puts a new message at the front (newest first)', () => {
    const list = [msg('5', 'maya', at(20))];
    expect(insertMessage(list, msg('6', 'jo', at(20, 1))).map((m) => m.id)).toEqual(['6', '5']);
  });

  it('lets the realtime copy of my message replace its temporary copy', () => {
    const tempId = makeTempId();
    expect(isTempId(tempId)).toBe(true);
    const list = [makeTempMessage(tempId, 'on my way', at(20, 5)), msg('5', 'maya', at(20))];
    const next = insertMessage(list, msg('9', 'me', at(20, 5), { body: 'on my way' }));
    expect(next.map((m) => m.id)).toEqual(['9', '5']);
  });

  it('only swaps one temporary copy per realtime message', () => {
    const a = makeTempMessage(makeTempId(), 'ok', at(20, 5));
    const b = makeTempMessage(makeTempId(), 'ok', at(20, 6));
    const next = insertMessage([b, a], msg('9', 'me', at(20, 5), { body: 'ok' }));
    // The older temporary message is the one confirmed; the newer one is still waiting.
    expect(next.map((m) => m.id)).toEqual([b.id, '9']);
  });

  it('does not merge someone else’s identical text', () => {
    const temp = makeTempMessage(makeTempId(), 'ok', at(20, 5));
    const next = insertMessage([temp], msg('9', 'maya', at(20, 5), { body: 'ok' }));
    expect(next.map((m) => m.id)).toEqual(['9', temp.id]);
  });

  it('confirmSent swaps the temp message for the real one', () => {
    const temp = makeTempMessage('tmp:1', 'hi', at(20));
    const real = msg('7', 'me', at(20), { body: 'hi' });
    expect(confirmSent([temp], 'tmp:1', real).map((m) => m.id)).toEqual(['7']);
  });

  it('confirmSent drops the temp message when realtime already delivered the real one', () => {
    const temp = makeTempMessage('tmp:1', 'hi', at(20));
    const real = msg('7', 'me', at(20), { body: 'hi' });
    expect(confirmSent([temp, real], 'tmp:1', real).map((m) => m.id)).toEqual(['7']);
  });

  it('confirmSent still shows the real message when a refetch already removed the temp one', () => {
    const real = msg('7', 'me', at(20), { body: 'hi' });
    expect(confirmSent([msg('2', 'maya', at(19))], 'tmp:1', real).map((m) => m.id)).toEqual(['7', '2']);
  });

  it('removeMessage rolls back a failed send', () => {
    const temp = makeTempMessage('tmp:1', 'hi', at(20));
    expect(removeMessage([temp, msg('1', 'maya', at(19))], 'tmp:1').map((m) => m.id)).toEqual(['1']);
  });

  it('an update replaces the row, and a deleted row has no text', () => {
    const list = [msg('2', 'jo', at(20)), msg('1', 'maya', at(19))];
    const updated = msg('1', 'maya', at(19), { body: null, deleted: true });
    const next = updateMessage(list, updated);
    expect(next[1]).toBe(updated);
    expect(updateMessage(list, msg('99', 'x', at(20)))).toBe(list);
    expect(markDeleted(list, '2')[0]).toMatchObject({ body: null, deleted: true });
  });
});

describe('messageA11yLabel', () => {
  it('reads "Name, time: text"', () => {
    expect(messageA11yLabel(msg('1', 'maya', at(21, 41), { displayName: 'Maya', body: 'see you' }))).toBe(
      'Maya, 9:41 PM: see you',
    );
  });
  it('says You for my messages and Message deleted for deleted ones', () => {
    expect(messageA11yLabel(msg('1', 'me', at(9, 5), { body: null, deleted: true }))).toBe('You, 9:05 AM: Message deleted');
  });
});

const chat = (over: Partial<ChatSummary>): ChatSummary => ({
  eventId: 'e',
  title: 'Event',
  startsAt: at(21),
  imageUrl: null,
  goingCount: 3,
  lastBody: null,
  lastAuthorName: null,
  lastAt: null,
  unreadCount: 0,
  isOpen: true,
  ...over,
});

describe('Chats list', () => {
  it('splits open chats from archived ones and keeps the order', () => {
    const chats = [
      chat({ eventId: 'a' }),
      chat({ eventId: 'b', isOpen: false }),
      chat({ eventId: 'c' }),
      chat({ eventId: 'd', isOpen: false }),
    ];
    const { upcoming, archived } = sectionChats(chats);
    expect(upcoming.map((c) => c.eventId)).toEqual(['a', 'c']);
    expect(archived.map((c) => c.eventId)).toEqual(['b', 'd']);
    expect(sectionChats([])).toEqual({ upcoming: [], archived: [] });
  });

  const now = at(12, 0); // Thu Oct 29, noon
  it.each([
    [at(21, 0), 'Tonight'],
    [at(15, 0), 'Today'],
    [at(18, 0, 30), 'Tomorrow'],
    [at(18, 0, 31), 'Sat'],
    [new Date(2026, 10, 7, 18), 'In 9 days'],
    [new Date(2026, 11, 25, 18), 'Dec 25'],
    [at(10, 0), 'Now'],
    [at(2, 0), 'Today'],
    [at(20, 0, 28), 'Yesterday'],
    [at(20, 0, 25), 'Sun'],
    [at(20, 0, 10), 'Oct 10'],
  ])('countdownLabel %s', (startsAt, label) => {
    expect(countdownLabel(startsAt as Date, now)).toBe(label);
  });

  it.each([
    [new Date(2026, 9, 29, 11, 59, 40), 'now'],
    [at(11, 55), '5m'],
    [at(9, 0), '3h'],
    [at(22, 0, 28), 'Yesterday'],
    [at(12, 0, 25), 'Sun'],
    [at(12, 0, 3), 'Oct 3'],
  ])('relativeTime %s', (date, label) => {
    expect(relativeTime(date, at(12, 0))).toBe(label);
  });

  it('previews the last message with the first name', () => {
    expect(chatPreview({ lastBody: 'see you at 8', lastAuthorName: 'Maya Chen' })).toBe('Maya: see you at 8');
    expect(chatPreview({ lastBody: null, lastAuthorName: null })).toBe('No messages yet. Say hi.');
  });

  it('caps the unread badge', () => {
    expect([0, 3, 99, 100].map(unreadBadge)).toEqual([null, '3', '99', '99+']);
  });

  it('writes the header subtitle', () => {
    const upcoming = { startsAt: at(21, 0) };
    expect(chatSubtitle(upcoming, 18, at(18, 0))).toBe('Tonight · in 3h · 18 going');
    expect(chatSubtitle(upcoming, 18, at(20, 30))).toBe('Tonight · in 30m · 18 going');
    expect(chatSubtitle(upcoming, null, at(21, 30))).toBe('Happening now');
    expect(chatSubtitle(upcoming, 18, at(21, 30))).toBe('Happening now · 18 going');
    expect(chatSubtitle({ startsAt: at(18, 0, 28) }, 18, at(2, 0, 30))).toBe('Ended · chat closes in 22h');
    expect(chatSubtitle({ startsAt: at(21, 0, 25) }, 18, NOW)).toBe('Sun · ended · 18 went');
  });
});
