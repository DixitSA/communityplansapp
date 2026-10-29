// Fictional sample activity so the screen has content before the backend exists.
export type Person = { id: string; name: string };

export type ActivityItem =
  | { kind: 'friend_going'; id: string; minutesAgo: number; person: Person; eventId: string; eventTitle: string }
  | { kind: 'friend_request'; id: string; minutesAgo: number; person: Person }
  | { kind: 'request_accepted'; id: string; minutesAgo: number; person: Person }
  | { kind: 'met'; id: string; minutesAgo: number; eventId: string; eventTitle: string; people: Person[] };

const maya = { id: 'u-maya', name: 'Maya Chen' };
const jordan = { id: 'u-jordan', name: 'Jordan Lee' };
const priya = { id: 'u-priya', name: 'Priya Nair' };
const lena = { id: 'u-lena', name: 'Lena Park' };
const sam = { id: 'u-sam', name: 'Sam Ortiz' };
const ana = { id: 'u-ana', name: 'Ana Reyes' };

export function getActivityItems(): ActivityItem[] {
  return [
    { kind: 'met', id: 'a-1', minutesAgo: 35, eventId: 'ev-005', eventTitle: 'Warehouse Party', people: [ana, lena] },
    { kind: 'friend_going', id: 'a-2', minutesAgo: 90, person: maya, eventId: 'ev-001', eventTitle: 'Sunset Vinyl Hour' },
    { kind: 'friend_request', id: 'a-3', minutesAgo: 240, person: priya },
    { kind: 'request_accepted', id: 'a-4', minutesAgo: 60 * 26, person: jordan },
    { kind: 'friend_going', id: 'a-5', minutesAgo: 60 * 30, person: sam, eventId: 'ev-007', eventTitle: 'Rooftop Happy Hour' },
  ];
}
