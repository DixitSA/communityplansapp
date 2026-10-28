import { create } from 'zustand';

import { startOfDay } from '@/lib/dates';

import {
  DEFAULT_CRITERIA,
  type DistanceMi,
  type FeedView,
  type Price,
  type Scope,
  type TimeOfDay,
} from './filters';

// Zustand is a tiny store that any screen can read from. Feed, the filters sheet and the
// map all read the same filters here, so changing one updates the others.
type FiltersState = {
  timeOfDay: TimeOfDay;
  interests: string[];
  distanceMi: DistanceMi;
  price: Price;
  view: FeedView;
  scope: Scope;
  selectedDay: Date;
  setTimeOfDay: (v: TimeOfDay) => void;
  toggleInterest: (slug: string) => void;
  setDistance: (v: DistanceMi) => void;
  setPrice: (v: Price) => void;
  setView: (v: FeedView) => void;
  setScope: (v: Scope) => void;
  setSelectedDay: (d: Date) => void;
  /** Resets time, interests, distance and price. Leaves Nearby/Friends, the view and the day alone. */
  clearFilters: () => void;
};

export const useFiltersStore = create<FiltersState>()((set) => ({
  ...DEFAULT_CRITERIA,
  view: 'list',
  selectedDay: startOfDay(new Date()),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  toggleInterest: (slug) =>
    set((s) => ({
      interests: s.interests.includes(slug)
        ? s.interests.filter((i) => i !== slug)
        : [...s.interests, slug],
    })),
  setDistance: (distanceMi) => set({ distanceMi }),
  setPrice: (price) => set({ price }),
  setView: (view) => set({ view }),
  setScope: (scope) => set({ scope }),
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  clearFilters: () =>
    set({
      timeOfDay: DEFAULT_CRITERIA.timeOfDay,
      interests: [],
      distanceMi: DEFAULT_CRITERIA.distanceMi,
      price: DEFAULT_CRITERIA.price,
    }),
}));
