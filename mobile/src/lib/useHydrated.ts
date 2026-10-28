import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the server renders and during the first client render of a hydrating web page,
 * true afterwards (always true on native). Screens that read window size or color scheme render
 * nothing until then, because the server can't know them and React won't repair a mismatched
 * server-rendered page.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
