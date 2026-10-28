import { create } from 'zustand';

/** The viewer's own plan for an event. `null` means no plan. */
export type PlanStatus = 'interested' | 'down_if_friends' | 'going';
export type PlanChoice = PlanStatus | null;

type PlansState = {
  /** Per-event status. A missing key means no plan. */
  statuses: Record<string, PlanStatus | undefined>;
  setStatus: (eventId: string, status: PlanChoice) => void;
  /**
   * The card's heart. No plan becomes Interested and Interested goes back to no plan.
   * Going and Down if friends go are left alone, so a stray tap can't undo a stronger plan.
   */
  toggleInterested: (eventId: string) => void;
};

export const usePlansStore = create<PlansState>((set) => ({
  statuses: {},
  setStatus: (eventId, status) =>
    set((s) => {
      const next = { ...s.statuses };
      if (status === null) delete next[eventId];
      else next[eventId] = status;
      return { statuses: next };
    }),
  toggleInterested: (eventId) =>
    set((s) => {
      const current = s.statuses[eventId];
      if (current && current !== 'interested') return s;
      const next = { ...s.statuses };
      if (current === 'interested') delete next[eventId];
      else next[eventId] = 'interested';
      return { statuses: next };
    }),
}));

/** The viewer's status for one event (re-renders only when that event changes). */
export function usePlanStatus(eventId: string): PlanChoice {
  return usePlansStore((s) => s.statuses[eventId] ?? null);
}
