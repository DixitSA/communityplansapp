import { MutationObserver, QueryClient } from '@tanstack/react-query';

import type { EventPage, FeedEvent } from '@/lib/api';

import { othersCount, toggleInterestedChoice } from '../plansLogic';
import { rsvpMutationOptions } from '../useRsvp';

jest.mock('@/lib/api', () => ({ api: { setRsvp: jest.fn() } }));

const card = (id: string, over: Partial<FeedEvent> = {}): FeedEvent => ({
  id,
  title: id,
  startsAt: new Date(0),
  venue: 'v',
  distanceMi: 1,
  interest: 'music',
  categoryLabel: 'Music',
  symbol: 'music.note',
  friends: [],
  friendsGoing: 0,
  goingCount: 4,
  myStatus: null,
  ...over,
});

const FEED_KEY = ['feed', 1, '2026-10-29'];

function setup() {
  // gcTime Infinity: no 5-minute cache-cleanup timers left running after the test (they kept Jest workers alive).
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  qc.setQueryData(FEED_KEY, [card('a'), card('b')]);
  qc.setQueryData(['event', 'a'], { ...card('a'), goingCount: 4, myStatus: null } as unknown as EventPage);
  return qc;
}

describe('optimistic RSVP', () => {
  it('updates feed and event caches before the server answers, then settles', async () => {
    const qc = setup();
    let release: () => void = () => {};
    const send = jest.fn(() => new Promise<void>((r) => (release = r)));
    const m = new MutationObserver(qc, rsvpMutationOptions(qc, send, jest.fn()));
    const done = m.mutate({ eventId: 'a', status: 'going' });
    await new Promise((r) => setTimeout(r, 0));
    const feed = qc.getQueryData<FeedEvent[]>(FEED_KEY)!;
    expect(feed[0]).toMatchObject({ myStatus: 'going', goingCount: 5 });
    expect(feed[1]).toMatchObject({ myStatus: null, goingCount: 4 });
    expect(qc.getQueryData<EventPage>(['event', 'a'])).toMatchObject({ myStatus: 'going', goingCount: 5 });
    release();
    await done;
  });

  it('rolls back and tells the user when the server fails', async () => {
    const qc = setup();
    const onFailure = jest.fn();
    const m = new MutationObserver(qc, rsvpMutationOptions(qc, () => Promise.reject(new Error('nope')), onFailure));
    await m.mutate({ eventId: 'a', status: 'going' }).catch(() => {});
    expect(qc.getQueryData<FeedEvent[]>(FEED_KEY)![0]).toMatchObject({ myStatus: null, goingCount: 4 });
    expect(qc.getQueryData<EventPage>(['event', 'a'])).toMatchObject({ myStatus: null, goingCount: 4 });
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});

describe('othersCount ("+N others")', () => {
  it('is going minus friends minus me', () => {
    expect(othersCount(10, 3, false)).toBe(7);
    expect(othersCount(10, 3, true)).toBe(6);
  });
  it('never goes negative', () => {
    expect(othersCount(1, 3, true)).toBe(0);
  });
});

describe('toggleInterestedChoice', () => {
  it('toggles Interested and leaves stronger plans alone', () => {
    expect(toggleInterestedChoice(null)).toBe('interested');
    expect(toggleInterestedChoice('interested')).toBeNull();
    expect(toggleInterestedChoice('going')).toBe('going');
    expect(toggleInterestedChoice('down_if_friends')).toBe('down_if_friends');
  });
});
