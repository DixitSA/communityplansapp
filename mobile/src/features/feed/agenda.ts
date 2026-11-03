import type { DayMeta } from '@/design';
import { MONTHS_SHORT, WEEKDAYS_LONG, startOfDay, toISODate } from '@/lib/dates';
import { defaultStockIndex, stockCountFor } from '@/design/stockImages';
import { parseDateOnly } from '@/lib/validation';

/** What the agenda needs from an event: its start, and optionally the city-local day the server computed. */
export type AgendaEvent = {
  startsAt: Date;
  day?: string;
  friendsGoing: number;
  id?: string;
  interest?: string;
  imageUrl?: string | null;
  stockVariant?: number | null;
};

/**
 * Within one day's events (in order), gives image-less events of the same category different stock photos. Each
 * keeps its own seeded pick when free (so it matches the event page hero), else the next unused photo; once a
 * category's photos are used up, `null` makes the rest show generated art. Events with their own image, or with
 * no id/interest, are untouched. Trade-off: a reassigned event's feed thumbnail differs from its event page hero
 * (which keeps the per-event pick); the hero is plumbed nowhere near the feed's day grouping.
 */
export function assignStockVariants<T extends AgendaEvent>(events: T[]): T[] {
  const used = new Map<string, Set<number>>();
  return events.map((e) => {
    if (e.imageUrl || !e.id || !e.interest) return e;
    const count = stockCountFor(e.interest);
    if (count === 0) return e;
    const taken = used.get(e.interest) ?? new Set<number>();
    used.set(e.interest, taken);
    const start = defaultStockIndex(e.interest, e.id);
    for (let i = 0; i < count; i++) {
      const index = (start + i) % count;
      if (!taken.has(index)) {
        taken.add(index);
        return index === start ? e : { ...e, stockVariant: index };
      }
    }
    return { ...e, stockVariant: null };
  });
}

export type AgendaSection<T extends AgendaEvent> = {
  /** Local day, "YYYY-MM-DD". */
  day: string;
  /** "Wed, Oct 28 · 5 events" */
  title: string;
  /** The header's big line: "Tonight", "Tomorrow", "Thursday" or "Thu, Nov 12". */
  headline: string;
  /** The small line under it: "Sat, Oct 31 · 49 events" (just the count when the headline is the date). */
  detail: string;
  isToday: boolean;
  data: T[];
};

/** The event's local day: the server's `day` when present, else the device's. */
export function eventDay(e: AgendaEvent): string {
  return e.day ?? toISODate(e.startsAt);
}

/** "2026-10-28" to local midnight (the date strip and the filters store use Dates). */
export function dayToDate(day: string): Date {
  return parseDateOnly(day) ?? startOfDay(new Date());
}

const shortDate = (d: Date) => `${WEEKDAYS_LONG[d.getDay()].slice(0, 3)}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
const eventCount = (count: number) => `${count} ${count === 1 ? 'event' : 'events'}`;

/** "Wed, Oct 28 · 5 events": the section's plain title (VoiceOver reads the headline and detail instead). */
export function formatAgendaTitle(day: string, count: number): string {
  return `${shortDate(dayToDate(day))} · ${eventCount(count)}`;
}

/** The day header's big line: a mood for today, "Tomorrow", the weekday within the week, else the date. */
export function agendaHeadline(day: string, today: string, now: Date): string {
  if (day === today) {
    const h = now.getHours();
    return h < 12 ? 'This morning' : h < 17 ? 'This afternoon' : 'Tonight';
  }
  const d = dayToDate(day);
  // Rounded, so a day with a daylight-saving change (23 or 25 hours) still counts as one.
  const daysAway = Math.round((d.getTime() - dayToDate(today).getTime()) / 86_400_000);
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway > 1 && daysAway < 7) return WEEKDAYS_LONG[d.getDay()];
  return shortDate(d);
}

/**
 * The small line under the headline: the date and the count (or just the count when the headline is the date),
 * plus how many are on right now: "Sat, Oct 31 · 8 events · 3 live".
 */
export function agendaDetail(day: string, headline: string, count: number, live = 0): string {
  const date = shortDate(dayToDate(day));
  const counts = live > 0 ? `${eventCount(count)} · ${live} live` : eventCount(count);
  return headline === date ? counts : `${date} · ${counts}`;
}

/** Events without an end time count as three hours long. */
const ASSUMED_LENGTH_MS = 3 * 3_600_000;

/** When the event is over: its end, or three hours after it starts. */
export function eventEndsAt(e: { startsAt: Date; endsAt?: Date }): number {
  return e.endsAt ? e.endsAt.getTime() : e.startsAt.getTime() + ASSUMED_LENGTH_MS;
}

/** Happening right now. */
export function isLive(e: { startsAt: Date; endsAt?: Date }, now: Date): boolean {
  return e.startsAt.getTime() <= now.getTime() && now.getTime() < eventEndsAt(e);
}

/** Already over, so the feed leaves it out. */
export function hasEnded(e: { startsAt: Date; endsAt?: Date }, now: Date): boolean {
  return eventEndsAt(e) <= now.getTime();
}

/**
 * Groups events into one section per local day, earliest day first and earliest event first within
 * a day. Days with no events get no section. `today` is "YYYY-MM-DD" (marks the accent-colored header).
 */
export function groupByDay<T extends AgendaEvent>(events: T[], today: string, now: Date = new Date()): AgendaSection<T>[] {
  const byDay = new Map<string, T[]>();
  for (const e of [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const key = eventDay(e);
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }
  return [...byDay.keys()]
    .sort()
    .map((day) => {
      const data = assignStockVariants(byDay.get(day) ?? []);
      const headline = agendaHeadline(day, today, now);
      return {
        day,
        title: formatAgendaTitle(day, data.length),
        headline,
        detail: agendaDetail(day, headline, data.length, data.filter((e) => isLive(e, now)).length),
        isToday: day === today,
        data,
      };
    });
}

/** Per-day counts for the date strip's density dots. */
export function dayMetaFrom(events: AgendaEvent[]): Record<string, DayMeta> {
  const meta: Record<string, DayMeta> = {};
  for (const e of events) {
    const key = eventDay(e);
    const m = meta[key] ?? { count: 0, friendsGoing: false };
    meta[key] = { count: m.count + 1, friendsGoing: m.friendsGoing || e.friendsGoing > 0 };
  }
  return meta;
}

/**
 * The index of the section a tap on `day` should scroll to: that day's own section, else the next
 * day that has events. `-1` when nothing is on or after that day.
 */
export function sectionIndexForDay(sections: { day: string }[], day: string): number {
  return sections.findIndex((s) => s.day >= day);
}

export type ItemLayout = { length: number; offset: number; index: number };

/**
 * Where every entry of the agenda's SectionList sits, for its `getItemLayout`. A SectionList counts a header,
 * the rows and a footer for each section (we draw no footers, so they take no space). Heights come from the
 * rows and headers measured so far; ones not drawn yet use an estimate. Jumping to a far-off day then lands
 * on it (exactly once the rows around it have drawn) without drawing every row in between. `leading` is the
 * height of anything above the first day (the list's header, e.g. the spotlight row).
 */
export function agendaItemLayouts<T extends { id: string }>(
  sections: { day: string; data: T[] }[],
  headerHeight: (day: string) => number,
  rowHeight: (item: T) => number,
  leading = 0,
): ItemLayout[] {
  const out: ItemLayout[] = [];
  let offset = leading;
  const push = (length: number) => {
    out.push({ length, offset, index: out.length });
    offset += length;
  };
  for (const s of sections) {
    push(headerHeight(s.day));
    for (const item of s.data) push(rowHeight(item));
    push(0);
  }
  return out;
}
