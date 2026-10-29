import { Link, useRouter } from 'expo-router';

import { EventCard, type EventCardData } from '@/design';

import type { RsvpStatus } from '@/lib/api';

import { openDirections, shareEvent } from './actions';
import { usePlan, useSetRsvp } from './useRsvp';

/**
 * An EventCard that opens the event page (zoom transition on iOS 18+) and shares the plans store,
 * so the corner indicator and the event page always agree. Long-press shows a preview and quick actions.
 */
export function EventCardLink({ event }: { event: EventCardData & { myStatus?: RsvpStatus | null; neighborhood?: string } }) {
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

  return (
    <EventCard
      event={event}
      plan={status}
      onToggleInterested={() => toggleInterested(event.id, status)}
      onOpenPlan={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      href={{ pathname: '/event/[id]', params: { id: event.id } }}
      menuActions={[
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
      ]}
    />
  );
}
