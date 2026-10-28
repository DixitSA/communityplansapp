import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { EventCard, type EventCardData } from '@/design';
import { getFixtureEvent } from '@/features/feed/fixtures';

import { openDirections, shareEvent } from './actions';
import { usePlanStatus, usePlansStore } from './plansStore';

/**
 * An EventCard that opens the event page (zoom transition on iOS 18+) and shares the plans store,
 * so the corner indicator and the event page always agree. Long-press shows a preview and quick actions.
 */
export function EventCardLink({ event }: { event: EventCardData }) {
  const router = useRouter();
  const status = usePlanStatus(event.id);
  const setStatus = usePlansStore((s) => s.setStatus);
  const toggleInterested = usePlansStore((s) => s.toggleInterested);
  const going = status === 'going';

  const goingAction = () => {
    if (going) {
      router.navigate('/chats');
      return;
    }
    setStatus(event.id, 'going');
    router.push({ pathname: '/event/[id]/going', params: { id: event.id } });
  };

  // Share and Directions need the full detail (address). Skip them if there is none.
  const detail = useMemo(() => getFixtureEvent(event.id), [event.id]);

  return (
    <EventCard
      event={event}
      plan={status}
      onToggleInterested={() => toggleInterested(event.id)}
      onOpenPlan={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      href={{ pathname: '/event/[id]', params: { id: event.id } }}
      menuActions={[
        <Link.MenuAction key="going" title={going ? 'Open chat' : 'Going'} icon="checkmark.circle" onPress={goingAction} />,
        status !== 'going' && status !== 'down_if_friends' ? (
          <Link.MenuAction
            key="interested"
            title={status === 'interested' ? 'Remove Interested' : 'Interested'}
            icon={status === 'interested' ? 'heart.slash' : 'heart'}
            onPress={() => toggleInterested(event.id)}
          />
        ) : null,
        detail ? (
          <Link.MenuAction key="share" title="Share" icon="square.and.arrow.up" onPress={() => shareEvent(detail, 'share')} />
        ) : null,
        detail ? <Link.MenuAction key="directions" title="Directions" icon="map" onPress={() => openDirections(detail)} /> : null,
      ]}
    />
  );
}
