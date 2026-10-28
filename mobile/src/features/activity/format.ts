/** "now", "5m", "3h", "2d": compact relative time for activity rows. */
export function formatAgo(minutesAgo: number): string {
  if (minutesAgo < 1) return 'now';
  if (minutesAgo < 60) return `${Math.floor(minutesAgo)}m`;
  if (minutesAgo < 60 * 24) return `${Math.floor(minutesAgo / 60)}h`;
  return `${Math.floor(minutesAgo / (60 * 24))}d`;
}
