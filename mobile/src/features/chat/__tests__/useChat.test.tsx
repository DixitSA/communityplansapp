import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, type ChatMessage, type ChatSubscription } from '@/lib/api';
import { chatService } from '@/lib/chat';

import { useChat } from '../useChat';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/chat', () => ({
  chatService: {
    getChatMessages: jest.fn(),
    sendMessage: jest.fn(),
    deleteMessage: jest.fn(),
    markChatRead: jest.fn(),
    subscribeToEventChat: jest.fn(),
  },
}));

const svc = chatService as unknown as Record<string, jest.Mock>;

const msg = (id: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  userId: 'maya',
  displayName: 'Maya',
  avatarPath: null,
  body: `text ${id}`,
  createdAt: new Date(2026, 9, 29, 20, Number(id)),
  isMine: false,
  deleted: false,
  ...over,
});

let handlers: ChatSubscription;
const wrapper = ({ children }: { children: ReactNode }) => {
  // gcTime Infinity: no 5-minute cache-cleanup timers left running after the test (they kept Jest workers alive).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  jest.clearAllMocks();
  svc.getChatMessages.mockResolvedValue([msg('2'), msg('1')]);
  svc.markChatRead.mockResolvedValue(undefined);
  svc.subscribeToEventChat.mockImplementation((_id: string, h: ChatSubscription) => {
    handlers = h;
    return jest.fn();
  });
});

const ids = (messages: ChatMessage[]) => messages.map((m) => m.id);

describe('useChat', () => {
  it('shows a sent message at once and swaps it when the server confirms', async () => {
    let confirm: (m: ChatMessage) => void = () => {};
    svc.sendMessage.mockReturnValue(new Promise<ChatMessage>((r) => (confirm = r)));
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['2', '1']));

    await act(async () => {
      result.current.send('  hello  ');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(result.current.messages[0]).toMatchObject({ body: 'hello', sending: true, isMine: true });

    await act(async () => confirm(msg('3', { isMine: true, userId: 'me', body: 'hello' })));
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['3', '2', '1']));
  });

  it('does not show my message twice when Realtime delivers it before the send resolves', async () => {
    let confirm: (m: ChatMessage) => void = () => {};
    svc.sendMessage.mockReturnValue(new Promise<ChatMessage>((r) => (confirm = r)));
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      result.current.send('hello');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(3));

    const real = msg('3', { isMine: true, userId: 'me', body: 'hello' });
    await act(async () => handlers.onInsert(real));
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['3', '2', '1']));
    await act(async () => confirm(real));
    await waitFor(() => expect(svc.sendMessage).toHaveBeenCalled());
    // Give the confirmation time to land before checking nothing doubled up.
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(ids(result.current.messages)).toEqual(['3', '2', '1']);
  });

  it('appends other people’s live messages once, and shows deletes as updates', async () => {
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => handlers.onInsert(msg('3')));
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['3', '2', '1']));
    expect(svc.markChatRead).not.toHaveBeenCalled(); // not focused in this test

    await act(async () => handlers.onUpdate(msg('2', { body: null, deleted: true })));
    await waitFor(() => expect(result.current.messages[1]).toMatchObject({ id: '2', deleted: true, body: null }));
  });

  it('rolls back a failed send, gives the text back and explains the rate limit', async () => {
    svc.sendMessage.mockRejectedValue(new ApiError('rate_limited'));
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      result.current.send('hello');
    });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(ids(result.current.messages)).toEqual(['2', '1']);
    expect(result.current.failure).toEqual({ message: expect.stringMatching(/too fast/i), body: 'hello' });
  });

  it('refetches when the live connection comes up, so nothing sent in the gap is missed', async () => {
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(svc.getChatMessages).toHaveBeenCalledTimes(1);
    svc.getChatMessages.mockResolvedValue([msg('3'), msg('2'), msg('1')]);
    await act(async () => handlers.onSubscribed?.());
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['3', '2', '1']));
    expect(svc.getChatMessages).toHaveBeenCalledTimes(2);
  });

  it('does not send empty text', async () => {
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    let accepted = true;
    await act(async () => {
      accepted = result.current.send('   ');
    });
    expect(accepted).toBe(false);
    expect(svc.sendMessage).not.toHaveBeenCalled();
  });

  it('loads older pages with the oldest id as before_id', async () => {
    const page = Array.from({ length: 50 }, (_, i) => msg(String(100 - i)));
    svc.getChatMessages.mockResolvedValueOnce(page).mockResolvedValueOnce([msg('50')]);
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(50));
    await act(async () => result.current.fetchOlder());
    await waitFor(() => expect(result.current.messages).toHaveLength(51));
    expect(svc.getChatMessages).toHaveBeenLastCalledWith('e1', '51');
    expect(result.current.hasOlder).toBe(false);
  });

  it('fetches and subscribes to nothing when the viewer is not going', async () => {
    await renderHook(() => useChat('e1', false), { wrapper });
    expect(svc.getChatMessages).not.toHaveBeenCalled();
    expect(svc.subscribeToEventChat).not.toHaveBeenCalled();
  });
});
