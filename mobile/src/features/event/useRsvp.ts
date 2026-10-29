import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { api, type EventPage, type FeedEvent, type RsvpStatus } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

import { toggleInterestedChoice } from './plansLogic';
import { usePlanStatus, usePlansStore, type PlanChoice } from './plansStore';

export type RsvpVars = { eventId: string; status: RsvpStatus | null };

type Snapshot = {
  feeds: [readonly unknown[], FeedEvent[] | undefined][];
  event: EventPage | null | undefined;
};

/** Same event, new plan: also moves `goingCount` when the viewer starts or stops being Going. */
function withStatus<T extends { myStatus: RsvpStatus | null; goingCount: number | null }>(e: T, status: RsvpStatus | null): T {
  const delta = (status === 'going' ? 1 : 0) - (e.myStatus === 'going' ? 1 : 0);
  return { ...e, myStatus: status, goingCount: e.goingCount === null ? null : Math.max(e.goingCount + delta, 0) };
}

export function applyRsvpToFeed(events: FeedEvent[], v: RsvpVars): FeedEvent[] {
  return events.map((e) => (e.id === v.eventId ? withStatus(e, v.status) : e));
}

export function applyRsvpToEvent(event: EventPage | null, v: RsvpVars): EventPage | null {
  return event && event.id === v.eventId ? withStatus(event, v.status) : event;
}

/**
 * Mutation options for changing a plan. "Optimistic" means the screens update the moment you tap,
 * before the server answers; if the server says no, we put the old data back and tell the user.
 */
export function rsvpMutationOptions(
  queryClient: QueryClient,
  send: (v: RsvpVars) => Promise<void>,
  onFailure: () => void,
) {
  return {
    mutationFn: send,
    onMutate: async (v: RsvpVars): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      await queryClient.cancelQueries({ queryKey: ['event', v.eventId] });
      const snapshot: Snapshot = {
        feeds: queryClient.getQueriesData<FeedEvent[]>({ queryKey: ['feed'] }),
        event: queryClient.getQueryData<EventPage | null>(['event', v.eventId]),
      };
      queryClient.setQueriesData<FeedEvent[]>({ queryKey: ['feed'] }, (old) => (old ? applyRsvpToFeed(old, v) : old));
      queryClient.setQueryData<EventPage | null>(['event', v.eventId], (old) => (old ? applyRsvpToEvent(old, v) : old));
      return snapshot;
    },
    onError: (_err: unknown, v: RsvpVars, snapshot: Snapshot | undefined) => {
      if (snapshot) {
        for (const [key, data] of snapshot.feeds) queryClient.setQueryData(key, data);
        queryClient.setQueryData(['event', v.eventId], snapshot.event);
      }
      onFailure();
    },
    onSettled: (_data: unknown, _err: unknown, v: RsvpVars) => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['event', v.eventId] });
      // Going adds or removes a chat.
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  };
}

/**
 * The viewer's plan for an event. When the backend is configured it comes from the server
 * (`serverStatus`, from the feed or event query); in demo mode it lives in the local plans store.
 */
export function usePlan(eventId: string, serverStatus: RsvpStatus | null | undefined): PlanChoice {
  const local = usePlanStatus(eventId);
  return isBackendConfigured ? (serverStatus ?? null) : local;
}

/** One way to change a plan, whichever mode the app is in. */
export function useSetRsvp() {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    rsvpMutationOptions(
      queryClient,
      (v) => api.setRsvp(v.eventId, v.status),
      () => Alert.alert('Couldn’t save your plan', 'Check your connection and try again.'),
    ),
  );
  const { mutate } = mutation;

  const setStatus = useCallback(
    (eventId: string, status: PlanChoice) => {
      if (isBackendConfigured) mutate({ eventId, status });
      else usePlansStore.getState().setStatus(eventId, status);
    },
    [mutate],
  );

  /** The card's heart; `current` is the plan the card is showing. */
  const toggleInterested = useCallback(
    (eventId: string, current: PlanChoice) => {
      const next = toggleInterestedChoice(current);
      if (next !== current) setStatus(eventId, next);
    },
    [setStatus],
  );

  return { setStatus, toggleInterested };
}
