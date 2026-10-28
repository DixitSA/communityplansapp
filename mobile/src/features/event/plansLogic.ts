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
export function attributionLine(source: { name: string; curated?: boolean }): string {
  return source.curated ? `Curated by ${source.name}` : `Listed via ${source.name}`;
}
