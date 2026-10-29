/** Development-only diagnostics. They show up in the Metro terminal; release builds stay silent. */
export function devLog(...args: unknown[]): void {
  if (__DEV__) console.log('[yard]', ...args);
}
