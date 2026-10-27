import type { EventCardData } from '@/design';
import { addDays, startOfWeekMonday } from '@/lib/dates';

// Fictional sample data so the feed has something to show before the backend exists.
const P = {
  maya: { id: 'u-maya', name: 'Maya' },
  jordan: { id: 'u-jordan', name: 'Jordan' },
  sam: { id: 'u-sam', name: 'Sam' },
  priya: { id: 'u-priya', name: 'Priya' },
  theo: { id: 'u-theo', name: 'Theo' },
};

type Seed = Omit<EventCardData, 'startsAt'> & { dayOffset: number; hour: number; minute?: number };

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
  return SEEDS.map(({ dayOffset, hour, minute = 0, ...rest }) => {
    const day = addDays(monday, dayOffset);
    return { ...rest, startsAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute) };
  });
}
