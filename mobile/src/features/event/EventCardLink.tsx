import { Link, useRouter } from 'expo-router';

import { EventCard, EventRow, type EventCardData } from '@/design';

import type { RsvpStatus } from '@/lib/api';

import { openDirections, shareEvent } from './actions';
import type { PlanChoice } from './plansStore';
import { usePlan, useSetRsvp } from './useRsvp';

type LinkableEvent = EventCardData & { myStatus?: RsvpStatus | null; neighborhood?: string };

/** What a card or row needs to open the event page, share the plans store and offer the long-press menu. */
function useEventLink(event: LinkableEvent) {
  const router = useRouter();
  const status = usePlan(event.id, event.myStatus);
  const { setStatus, toggleInterested } = useSetRsvp();
  const going = status === 'going';

  const goingAction = () => {
    if (going) {
      router.navigate('/chats');
      return;
    }
    setStatus(event.id, 'going');
    router.push({ pathname: '/event/[id]/going', params: { id: event.id } });
  };

  return {
    plan: status,
    onSetPlan: (next: PlanChoice) => {
      if (next === 'going') {
        if (!going) goingAction();
      } else setStatus(event.id, next);
    },
    onToggleInterested: () => toggleInterested(event.id, status),
    onOpenPlan: () => router.push({ pathname: '/event/[id]', params: { id: event.id } }),
    href: { pathname: '/event/[id]', params: { id: event.id } } as const,
    menuActions: [
      <Link.MenuAction key="going" title={going ? 'Open chat' : 'Going'} icon="checkmark.circle" onPress={goingAction} />,
      status !== 'going' && status !== 'down_if_friends' ? (
        <Link.MenuAction
          key="interested"
          title={status === 'interested' ? 'Remove Interested' : 'Interested'}
          icon={status === 'interested' ? 'heart.slash' : 'heart'}
          onPress={() => toggleInterested(event.id, status)}
        />
      ) : null,
      <Link.MenuAction key="share" title="Share" icon="square.and.arrow.up" onPress={() => shareEvent(event, 'share')} />,
      <Link.MenuAction
        key="directions"
        title="Directions"
        icon="map"
        onPress={() => openDirections({ venue: event.venue, address: event.neighborhood ?? 'Charlotte, NC' })}
      />,
    ],
  };
}

/**
 * An EventCard that opens the event page (zoom transition on iOS 18+) and shares the plans store,
 * so the corner indicator and the event page always agree. Long-press shows a preview and quick actions.
 */
export function EventCardLink({ event }: { event: LinkableEvent }) {
  const l = useEventLink(event);
  return (
    <EventCard
      event={event}
      plan={l.plan}
      onToggleInterested={l.onToggleInterested}
      onOpenPlan={l.onOpenPlan}
      href={l.href}
      menuActions={l.menuActions}
    />
  );
}

/** The compact agenda row, wired up the same way as `EventCardLink`. */
export function EventRowLink({ event }: { event: LinkableEvent & { goingCount?: number } }) {
  const l = useEventLink(event);
  return <EventRow event={event} plan={l.plan} onSetPlan={l.onSetPlan} href={l.href} menuActions={l.menuActions} />;
}
