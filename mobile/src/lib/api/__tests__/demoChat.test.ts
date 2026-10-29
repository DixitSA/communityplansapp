import { usePlansStore } from '@/features/event/plansStore';

import { createDemoApi } from '../demo';
import type { ChatMessage } from '../types';

// A Thursday, so this week's Wednesday event is still open and last week's is archived.
const NOW = new Date(2026, 9, 29, 12, 0);
const GOING = 'ev-005';
const OLD = 'ev-001-w-1';

function setup() {
  usePlansStore.setState({ statuses: { [GOING]: 'going', [OLD]: 'going', 'ev-003': 'interested' } });
  return createDemoApi({ delayMs: 0, now: () => NOW });
}

afterEach(() => usePlansStore.setState({ statuses: {} }));

describe('demo chat API', () => {
  it('lists chats for events I am going to, open first, with unread counts', async () => {
    const chats = await setup().getMyChats();
    expect(chats.map((c) => c.eventId)).toEqual([GOING, OLD]);
    expect(chats.map((c) => c.isOpen)).toEqual([true, false]);
    expect(chats[0]).toMatchObject({ unreadCount: 1, lastAuthorName: 'Jordan' });
    expect(chats[0].lastBody).toContain('green jacket');
  });

  it('gives nothing to someone who is not going', async () => {
    const api = setup();
    expect(await api.getChatMessages('ev-003')).toEqual([]);
  });

  it('pages messages newest first with before_id', async () => {
    const api = setup();
    const all = await api.getChatMessages(GOING);
    expect(all.map((m) => Number(m.id))).toEqual([...all.map((m) => Number(m.id))].sort((a, b) => b - a));
    const older = await api.getChatMessages(GOING, all[2].id);
    expect(older.map((m) => m.id)).toEqual(all.slice(3).map((m) => m.id));
  });

  it('trims, stores and broadcasts a sent message', async () => {
    const api = setup();
    const heard: ChatMessage[] = [];
    const stop = api.subscribeToEventChat(GOING, { onInsert: (m) => heard.push(m), onUpdate: () => {} });
    const sent = await api.sendMessage(GOING, '  on my way  ');
    expect(sent).toMatchObject({ body: 'on my way', isMine: true });
    expect(heard.map((m) => m.id)).toEqual([sent.id]);
    expect((await api.getChatMessages(GOING))[0].id).toBe(sent.id);
    stop();
    await api.sendMessage(GOING, 'again');
    expect(heard).toHaveLength(1);
  });

  it('rejects empty messages, closed chats and floods', async () => {
    const api = setup();
    await expect(api.sendMessage(GOING, '   ')).rejects.toMatchObject({ code: 'empty_message' });
    await expect(api.sendMessage(OLD, 'hello?')).rejects.toMatchObject({ code: 'chat_closed' });
    for (let i = 0; i < 30; i++) await api.sendMessage(GOING, `m${i}`);
    await expect(api.sendMessage(GOING, 'one too many')).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('soft-deletes my messages only, and tells subscribers', async () => {
    const api = setup();
    const updates: ChatMessage[] = [];
    api.subscribeToEventChat(GOING, { onInsert: () => {}, onUpdate: (m) => updates.push(m) });
    const mine = await api.sendMessage(GOING, 'oops');
    const theirs = (await api.getChatMessages(GOING)).find((m) => !m.isMine) as ChatMessage;
    await expect(api.deleteMessage(theirs.id)).rejects.toMatchObject({ code: 'not_found' });
    await api.deleteMessage(mine.id);
    expect(updates[0]).toMatchObject({ id: mine.id, body: null, deleted: true });
    expect((await api.getChatMessages(GOING))[0]).toMatchObject({ id: mine.id, deleted: true, body: null });
  });

  it('marks a chat read', async () => {
    const api = setup();
    await api.markChatRead(GOING);
    expect((await api.getMyChats())[0].unreadCount).toBe(0);
  });

  it('hides a blocked person’s messages', async () => {
    const api = setup();
    const theirs = (await api.getChatMessages(GOING)).find((m) => !m.isMine) as ChatMessage;
    await api.reportMessage(theirs.id, 'spam');
    await api.blockUser(theirs.userId);
    const after = await api.getChatMessages(GOING);
    expect(after.some((m) => m.userId === theirs.userId)).toBe(false);
    expect(after.length).toBeGreaterThan(0);
  });
});
