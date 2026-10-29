import type { EventCardData } from '@/design';
import type { EventDetail } from '@/features/event/types';
import { addDays, startOfDay, startOfWeekMonday } from '@/lib/dates';

// Fictional sample data so the feed has something to show before the backend exists.
const P = {
  maya: { id: 'u-maya', name: 'Maya' },
  jordan: { id: 'u-jordan', name: 'Jordan' },
  sam: { id: 'u-sam', name: 'Sam' },
  priya: { id: 'u-priya', name: 'Priya' },
  theo: { id: 'u-theo', name: 'Theo' },
};

type Seed = Omit<EventCardData, 'startsAt' | 'endsAt'> & { dayOffset: number; hour: number; minute?: number; hours?: number };

const SEEDS: Seed[] = [
  {
    id: 'ev-001', dayOffset: 1, hour: 18, minute: 30, title: 'Sunset Vinyl Hour', venue: 'Haberdish',
    distanceMi: 1.4, interest: 'music', symbol: 'music.note', categoryLabel: 'Music',
    friends: [P.maya], friendsGoing: 1,
  },
  {
    id: 'ev-002', dayOffset: 1, hour: 20, title: 'Taco Tuesday Run Club', venue: 'Camp North End',
    distanceMi: 3.2, interest: 'fitness', symbol: 'figure.run', categoryLabel: 'Fitness',
    friends: [], friendsGoing: 0,
  },
  {
    id: 'ev-003', dayOffset: 2, hour: 12, title: 'Lunchtime Food Truck Rally', venue: 'Uptown Green',
    distanceMi: 0.8, interest: 'food_drinks', symbol: 'fork.knife', categoryLabel: 'Food & Drinks',
    friends: [P.jordan, P.sam], friendsGoing: 2,
  },
  {
    id: 'ev-004', dayOffset: 2, hour: 19, title: 'Open Mic and Mezcal', venue: 'Evening Muse, NoDa',
    distanceMi: 2.6, interest: 'music', symbol: 'music.note', categoryLabel: 'Music',
    friends: [P.priya], friendsGoing: 1,
  },
  {
    id: 'ev-005', dayOffset: 2, hour: 21, title: 'Warehouse Party', venue: 'The District, South End',
    distanceMi: 2.1, interest: 'nightlife', symbol: 'moon.stars.fill', categoryLabel: 'Nightlife',
    friends: [P.maya, P.jordan, P.theo, P.sam, P.priya], friendsGoing: 5,
  },
  {
    id: 'ev-006', dayOffset: 3, hour: 18, title: 'Clay Night: Date Night Edition', venue: 'Plaza Midwood Studio',
    distanceMi: 3.9, interest: 'arts_culture', symbol: 'paintpalette.fill', categoryLabel: 'Arts',
    friends: [P.theo], friendsGoing: 1,
  },
  {
    id: 'ev-007', dayOffset: 4, hour: 17, minute: 30, title: 'Rooftop Happy Hour', venue: 'Skye Bar, Uptown',
    distanceMi: 0.9, interest: 'nightlife', symbol: 'moon.stars.fill', categoryLabel: 'Nightlife',
    friends: [P.sam, P.priya], friendsGoing: 4,
  },
  {
    id: 'ev-008', dayOffset: 4, hour: 20, minute: 30, title: 'Comedy Showcase', venue: 'Camp North End',
    distanceMi: 3.2, interest: 'arts_culture', symbol: 'theatermasks.fill', categoryLabel: 'Arts',
    friends: [], friendsGoing: 0,
  },
  {
    id: 'ev-009', dayOffset: 5, hour: 9, title: 'Saturday Greenway Brunch Ride', venue: 'Freedom Park',
    distanceMi: 2.8, interest: 'fitness', symbol: 'figure.run', categoryLabel: 'Fitness',
    friends: [P.maya, P.theo], friendsGoing: 2,
  },
  {
    id: 'ev-010', dayOffset: 5, hour: 22, title: 'Late Night Ramen Pop-up', venue: 'NoDa Brewing',
    distanceMi: 2.7, interest: 'food_drinks', symbol: 'fork.knife', categoryLabel: 'Food & Drinks',
    friends: [], friendsGoing: 0,
  },
];

/** Sample events spread across the current Mon-Sun week. Sunday is intentionally empty. */
export function getFixtureEvents(now: Date = new Date()): EventCardData[] {
  const monday = startOfWeekMonday(now);
  return SEEDS.map(({ dayOffset, hour, minute = 0, hours = 2, ...rest }) => {
    const day = addDays(monday, dayOffset);
    const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
    return { ...rest, startsAt, endsAt: new Date(startsAt.getTime() + hours * 3_600_000) };
  });
}

/** Ids of the repeats in following weeks: "ev-005" is this week's, "ev-005-w1" is the same event a week later. */
const WEEK_SUFFIX = /^(.+)-w(\d+)$/;

/**
 * The sample week repeated for the weeks `[start, start + days)` touches, so the agenda has
 * more than one week to scroll. Events outside the range are dropped. Week 0 keeps the plain ids.
 */
export function getFixtureEventsInRange(start: Date, days: number): EventCardData[] {
  const first = startOfDay(start);
  const end = addDays(first, days);
  const weeks = Math.ceil((days + 6) / 7) + 1;
  const out: EventCardData[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const e of getFixtureEvents(addDays(start, w * 7))) {
      // Week 0 of `getFixtureEvents` is the Mon-Sun week of `start`, so later weeks are +7 days each.
      if (e.startsAt >= first && e.startsAt < end) out.push(w === 0 ? e : { ...e, id: `${e.id}-w${w}` });
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

type DetailSeed = Omit<EventDetail, keyof EventCardData | 'tags'> & {
  /** Tags after the primary category. */
  moreTags?: { label: string; interest: string }[];
};

// Fictional people who are not your friends. Shown only after you're Going.
const O = [
  { id: 'o-alex', name: 'Alex Rivera' },
  { id: 'o-dani', name: 'Dani Brooks' },
  { id: 'o-kofi', name: 'Kofi Mensah' },
  { id: 'o-lena', name: 'Lena Park' },
  { id: 'o-ravi', name: 'Ravi Patel' },
];

const DETAILS: Record<string, DetailSeed> = {
  'ev-001': {
    description:
      'Golden hour, a crate of records and a patio with good fried chicken. A local DJ spins soul and funk from the 70s while the sun goes down. Come alone or bring a friend; the best seats are the ones next to strangers.',
    address: '1218 Thomas Ave, Charlotte, NC',
    host: { name: 'Haberdish', kind: 'venue' },
    priceLabel: 'Free',
    source: { name: 'yard', curated: true },
    otherAttendees: O.slice(0, 4),
    othersGoing: 23,
  },
  'ev-002': {
    description:
      'A relaxed 5K loop around Camp North End, then tacos for everyone who finishes (or just shows up). All paces welcome, and the back of the pack gets the loudest cheers.',
    address: '1824 Statesville Ave, Charlotte, NC',
    host: { name: 'Chris Park', kind: 'organizer' },
    priceLabel: 'Free',
    moreTags: [{ label: 'Food & Drinks', interest: 'food_drinks' }],
    source: { name: 'Eventbrite', url: 'https://www.eventbrite.com' },
    otherAttendees: O.slice(1, 5),
    othersGoing: 31,
  },
  'ev-003': {
    description:
      'Twelve food trucks parked around the green, one lunch hour. Bring a friend, split a few plates and try something you cannot pronounce yet.',
    address: '435 S Tryon St, Charlotte, NC',
    host: { name: 'Uptown Green', kind: 'venue' },
    priceLabel: 'Free entry',
    source: { name: 'Charlotte Center City Partners' },
    otherAttendees: O.slice(0, 3),
    othersGoing: 56,
  },
  'ev-004': {
    description:
      'Sign up at the door for a five-minute slot, or just come to listen. House mezcal flights are half price during the first hour, and the host keeps the room friendly.',
    address: '3227 N Davidson St, Charlotte, NC',
    host: { name: 'Evening Muse', kind: 'venue' },
    priceLabel: '$8',
    moreTags: [{ label: 'Food & Drinks', interest: 'food_drinks' }],
    source: { name: 'Eventbrite', url: 'https://www.eventbrite.com' },
    otherAttendees: O.slice(2, 5),
    othersGoing: 14,
  },
  'ev-005': {
    description:
      'Two rooms, one rooftop and a sound system people still talk about. Doors at nine, the first set starts around ten. Dress for dancing and keep your ID handy.',
    address: '1500 Camden Rd, Charlotte, NC',
    host: { name: 'Jordan Reyes', kind: 'organizer' },
    priceLabel: '$20 to $35',
    moreTags: [{ label: 'Music', interest: 'music' }],
    source: { name: 'yard', curated: true },
    otherAttendees: O,
    othersGoing: 142,
  },
  'ev-006': {
    description:
      'Make a pair of mugs at the wheel with a teacher who has seen every kind of wobbly bowl. Great for dates, double dates or flying solo. Clay, tools and one glaze each are included.',
    address: '1500 Central Ave, Charlotte, NC',
    host: { name: 'Plaza Midwood Studio', kind: 'venue' },
    priceLabel: '$45',
    source: { name: 'Eventbrite', url: 'https://www.eventbrite.com' },
    otherAttendees: O.slice(0, 2),
    othersGoing: 9,
  },
  'ev-007': {
    description:
      'Cheap drinks, a skyline view and a good crowd before the weekend starts. Arrive early to grab a spot near the glass; the sunset is free.',
    address: '100 N Tryon St, Charlotte, NC',
    host: { name: 'Skye Bar', kind: 'venue' },
    priceLabel: 'Free entry',
    moreTags: [{ label: 'Food & Drinks', interest: 'food_drinks' }],
    source: { name: 'yard', curated: true },
    otherAttendees: O.slice(1, 4),
    othersGoing: 38,
  },
  'ev-008': {
    description:
      'Six local comedians, one hour and a very forgiving audience. The front row is a trap. Grab a seat in the middle and bring a friend who laughs loudly.',
    address: '300 Camp Rd, Charlotte, NC',
    host: { name: 'Camp North End', kind: 'venue' },
    priceLabel: '$15',
    source: { name: 'Eventbrite', url: 'https://www.eventbrite.com' },
    otherAttendees: O.slice(2, 5),
    othersGoing: 47,
  },
  'ev-009': {
    description:
      'An easy ride along the greenway with a brunch stop halfway. Loaner bikes are limited, so bring your own if you can. We regroup at every intersection, so no one gets dropped.',
    address: '1900 East Blvd, Charlotte, NC',
    host: { name: 'Priya Nair', kind: 'organizer' },
    priceLabel: 'Free',
    moreTags: [{ label: 'Food & Drinks', interest: 'food_drinks' }],
    source: { name: 'Charlotte Bike Collective' },
    otherAttendees: O.slice(0, 4),
    othersGoing: 18,
  },
  'ev-010': {
    description:
      'A one-night ramen counter inside the brewery taproom. Three bowls, one vegetarian, and a limited batch of tonkotsu that sells out by eleven.',
    address: '2921 N Tryon St, Charlotte, NC',
    host: { name: 'NoDa Brewing', kind: 'venue' },
    priceLabel: '$14 a bowl',
    source: { name: 'yard', curated: true },
    otherAttendees: O.slice(1, 3),
    othersGoing: 12,
  },
};

/** One fixture event with everything the event page needs, or undefined for an unknown id. */
export function getFixtureEvent(id: string, now: Date = new Date()): EventDetail | undefined {
  const repeat = WEEK_SUFFIX.exec(id);
  const baseId = repeat ? repeat[1] : id;
  const card = getFixtureEvents(addDays(now, repeat ? Number(repeat[2]) * 7 : 0))
    .find((e) => e.id === baseId);
  const detail = DETAILS[baseId];
  if (!card || !detail) return undefined;
  const { moreTags = [], ...rest } = detail;
  return {
    ...card,
    id,
    ...rest,
    tags: [{ label: card.categoryLabel, interest: card.interest }, ...moreTags],
  };
}
