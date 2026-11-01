import type { PlanChoice } from './plansStore';

/** The one-line privacy hint under the RSVP row. Nothing until the viewer chooses. */
export function privacyHint(status: PlanChoice): string | null {
  switch (status) {
    case 'interested':
    case 'down_if_friends':
      return 'Only you can see this';
    case 'going':
      return 'Friends and other attendees can see this';
    default:
      return null;
  }
}

/** Other attendees stay hidden until the viewer is Going (DESIGN.md 4.6). */
export function othersRevealed(status: PlanChoice): boolean {
  return status === 'going';
}

/** "+14 others", "+1 other". */
export function othersLabel(count: number): string {
  return `+${count} ${count === 1 ? 'other' : 'others'}`;
}

/** What each RSVP button does when tapped: choosing the active one again clears it. */
export function nextStatus(current: PlanChoice, tapped: Exclude<PlanChoice, null>): PlanChoice {
  if (tapped === 'going') return 'going';
  return current === tapped ? null : tapped;
}

/** "Curated by yard", "Listed via Eventbrite". */
/** The source's name without the lead-in some sources store with it ("via Eventbrite", "Source: camp.nc", "Tickets on Ticketmaster"). */
export function sourceName(name: string): string {
  return name.replace(/^\s*(listed via|via|source:|tickets on)\s+/i, '').trim() || name;
}

export function attributionLine(source: { name: string; curated?: boolean }): string {
  return source.curated ? `Curated by ${sourceName(source.name)}` : `Listed via ${sourceName(source.name)}`;
}

/**
 * "+N others" on the event page: everyone going who isn't a friend and isn't you.
 * `goingCount` comes from the server and includes the viewer when they are Going.
 */
export function othersCount(goingCount: number, friendsGoing: number, viewerGoing: boolean): number {
  return Math.max(goingCount - friendsGoing - (viewerGoing ? 1 : 0), 0);
}

/**
 * The card's heart: no plan becomes Interested, Interested clears. Going and Down if friends go
 * stay as they are, so a stray tap can't undo a stronger plan.
 */
export function toggleInterestedChoice(current: PlanChoice): PlanChoice {
  if (current && current !== 'interested') return current;
  return current === 'interested' ? null : 'interested';
}

/**
 * The social line on the Going sheet, now that the viewer is going too: "Maya and Sam are going too",
 * "Maya and 14 others are going too", "You and 6 others are going", or a nudge when nobody else is in yet.
 * `friendNames` are friends we can show; `friendsGoing` is every friend going; `others` everyone else but you.
 */
export function goingTogetherLine(friendNames: string[], friendsGoing: number, others: number): string {
  const friends = Math.max(friendsGoing, friendNames.length);
  const shown = friendNames.slice(0, 2);
  const rest = friends - shown.length + Math.max(others, 0);
  const people = (n: number) => `${n} ${n === 1 ? 'other' : 'others'}`;
  if (shown.length === 0) return rest > 0 ? `You and ${people(rest)} are going` : "You're the first one in. Bring a friend?";
  if (rest === 0) return shown.length === 1 ? `${shown[0]} is going too` : `${shown[0]} and ${shown[1]} are going too`;
  return `${shown.join(', ')} and ${people(rest)} are going too`;
}
