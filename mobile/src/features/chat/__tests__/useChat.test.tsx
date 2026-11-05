import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useState, type ReactNode } from 'react';

import { ApiError, type ChatMessage, type ChatSubscription } from '@/lib/api';
import { chatService } from '@/lib/chat';

import { useChat } from '../useChat';

const mockFocusCallbacks: (() => void | (() => void))[] = [];

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockFocusCallbacks.push(callback);
    }, [callback]);
  },
}));
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
const clients = new Set<QueryClient>();

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
let restoreAppState: (() => void) | null = null;
const Wrapper = ({ children }: { children: ReactNode }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
          mutations: { gcTime: Infinity },
        },
      }),
  );
  clients.add(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
const wrapper = Wrapper;

afterEach(() => {
  mockFocusCallbacks.length = 0;
  restoreAppState?.();
  restoreAppState = null;
  for (const client of clients) client.clear();
  clients.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

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

  it('catches up when the connection becomes ready before initial history resolves', async () => {
    let resolveInitial!: (messages: ChatMessage[]) => void;
    svc.getChatMessages.mockImplementationOnce(() => new Promise((resolve) => (resolveInitial = resolve)));
    const { result } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(svc.getChatMessages).toHaveBeenCalledTimes(1));

    svc.getChatMessages.mockResolvedValue([msg('3'), msg('2'), msg('1')]);
    await act(async () => {
      handlers.onSubscribed?.();
      await Promise.resolve();
    });
    await act(async () => {
      resolveInitial([msg('2'), msg('1')]);
      await Promise.resolve();
    });

    await waitFor(() => expect(svc.getChatMessages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['3', '2', '1']));
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

  it('polls missed history only while focused, active and idle', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    restoreAppState = () => {
      if (originalDescriptor) Object.defineProperty(AppState, 'currentState', originalDescriptor);
    };
    Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
    svc.getChatMessages.mockResolvedValue([]);
    const polls: (() => void | Promise<void>)[] = [];
    const intervalHandles: number[] = [];
    const clearedIntervals: number[] = [];
    const nativeSetInterval = globalThis.setInterval;
    const nativeClearInterval = globalThis.clearInterval;
    jest.spyOn(globalThis, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay !== 30_000) return nativeSetInterval(callback, delay);
      polls.push(callback as () => void);
      const handle = polls.length;
      intervalHandles.push(handle);
      return handle as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);
    jest.spyOn(globalThis, 'clearInterval').mockImplementation((handle) => {
      if (intervalHandles.includes(handle as number)) clearedIntervals.push(handle as number);
      else nativeClearInterval(handle);
    });
    const firePoll = () => polls[polls.length - 1]?.();
    const { result, unmount } = await renderHook(() => useChat('e1'), { wrapper });
    await waitFor(() => expect(ids(result.current.messages)).toEqual([]));
    await waitFor(() => expect(Array.from(clients)[0]?.getQueryState(['chat', 'e1'])?.fetchStatus).toBe('idle'));

    const focus = () => mockFocusCallbacks.slice(-2).map((callback) => callback());
    let focusCleanups: ReturnType<typeof focus> = [];
    await act(async () => {
      focusCleanups = focus();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    await waitFor(() => expect(svc.getChatMessages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(Array.from(clients)[0]?.getQueryState(['chat', 'e1'])?.fetchStatus).toBe('idle'));
    const readCallsBeforePoll = svc.markChatRead.mock.calls.length;
    svc.getChatMessages.mockResolvedValue([msg('3')]);

    await act(async () => {
      await firePoll();
    });
    await waitFor(() => expect(svc.getChatMessages).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['3']));
    await waitFor(() => expect(svc.markChatRead).toHaveBeenCalledTimes(readCallsBeforePoll + 1));
    await waitFor(() => expect(Array.from(clients)[0]?.getQueryState(['chat', 'e1'])?.fetchStatus).toBe('idle'));
    const pollCount = polls.length;

    AppState.currentState = 'background';
    await act(async () => {
      await firePoll();
    });
    expect(svc.getChatMessages).toHaveBeenCalledTimes(3);

    AppState.currentState = 'active';
    let resolveSend!: (message: ChatMessage) => void;
    svc.sendMessage.mockReturnValue(new Promise<ChatMessage>((resolve) => (resolveSend = resolve)));
    await act(async () => {
      result.current.send('hello');
      await Promise.resolve();
    });
    await waitFor(() => expect(svc.sendMessage).toHaveBeenCalledTimes(1));
    await act(async () => {
      await firePoll();
    });
    expect(svc.getChatMessages).toHaveBeenCalledTimes(3);
    expect(polls).toHaveLength(pollCount);
    await act(async () => resolveSend(msg('4', { isMine: true, userId: 'maya' })));

    let resolveDelete!: (value: void) => void;
    svc.deleteMessage.mockReturnValue(new Promise<void>((resolve) => (resolveDelete = resolve)));
    let deletePromise!: Promise<void>;
    await act(async () => {
      deletePromise = result.current.deleteMessage('1');
      await Promise.resolve();
    });
    await waitFor(() => expect(svc.deleteMessage).toHaveBeenCalledWith('1'));
    await act(async () => {
      await firePoll();
    });
    expect(svc.getChatMessages).toHaveBeenCalledTimes(3);
    expect(polls).toHaveLength(pollCount);
    await act(async () => resolveDelete());
    await deletePromise;

    await waitFor(() => expect(Array.from(clients)[0]?.getQueryState(['chat', 'e1'])?.fetchStatus).toBe('idle'));
    focusCleanups.forEach((cleanup) => typeof cleanup === 'function' && cleanup());
    expect(clearedIntervals).toHaveLength(1);
    await act(async () => {
      await firePoll();
    });
    expect(svc.getChatMessages).toHaveBeenCalledTimes(3);
    svc.getChatMessages.mockResolvedValue([msg('4'), msg('3')]);
    await act(async () => {
      focusCleanups = focus();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    await waitFor(() => expect(svc.getChatMessages).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['4', '3']));
    expect(polls.length).toBeGreaterThan(pollCount);

    focusCleanups.forEach((cleanup) => typeof cleanup === 'function' && cleanup());
    expect(clearedIntervals).toHaveLength(2);
    unmount();
    const callsAtBlur = svc.getChatMessages.mock.calls.length;
    await act(async () => firePoll());
    expect(svc.getChatMessages).toHaveBeenCalledTimes(callsAtBlur);
  });
});
