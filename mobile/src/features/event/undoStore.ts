import { create } from 'zustand';

export type UndoToastData = { id: number; message: string; onUndo: () => void };

type UndoState = {
  toast: UndoToastData | null;
  /**
   * Extra room a screen needs at the bottom (the event page's pinned RSVP bar), so the toast sits above it.
   * Null means the default spot above the tab bar.
   */
  lift: number | null;
  setLift: (px: number | null) => void;
  showUndo: (t: { message: string; onUndo: () => void }) => void;
  dismiss: () => void;
};

let nextId = 1;

/** The one toast on screen, shared by every screen. A new one replaces the old. */
export const useUndoStore = create<UndoState>((set) => ({
  toast: null,
  lift: null,
  setLift: (lift) => set({ lift }),
  showUndo: (t) => set({ toast: { id: nextId++, ...t } }),
  dismiss: () => set({ toast: null }),
}));

export const showUndo = (t: { message: string; onUndo: () => void }) => useUndoStore.getState().showUndo(t);
