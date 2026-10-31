import type { DayMeta } from '@/design';
import { MONTHS_SHORT, WEEKDAYS_LONG, startOfDay, toISODate } from '@/lib/dates';
import { parseDateOnly } from '@/lib/validation';

/** What the agenda needs from an event: its start, and optionally the city-local day the server computed. */
export type AgendaEvent = { startsAt: Date; day?: string; friendsGoing: number };

export type AgendaSection<T extends AgendaEvent> = {
  /** Local day, "YYYY-MM-DD". */
  day: string;
  /** "Wed, Oct 28 · 5 events" */
  title: string;
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

/** "Wed, Oct 28 · 5 events": the sticky section header. */
export function formatAgendaTitle(day: string, count: number): string {
  const d = dayToDate(day);
  return `${WEEKDAYS_LONG[d.getDay()].slice(0, 3)}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} · ${count} ${count === 1 ? 'event' : 'events'}`;
}

/**
 * Groups events into one section per local day, earliest day first and earliest event first within
 * a day. Days with no events get no section. `today` is "YYYY-MM-DD" (marks the accent-colored header).
 */
export function groupByDay<T extends AgendaEvent>(events: T[], today: string): AgendaSection<T>[] {
  const byDay = new Map<string, T[]>();
  for (const e of [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const key = eventDay(e);
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }
  return [...byDay.keys()]
    .sort()
    .map((day) => ({ day, title: formatAgendaTitle(day, byDay.get(day)?.length ?? 0), isToday: day === today, data: byDay.get(day) ?? [] }));
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
 * the rows and a footer for each section (we draw no footers, so they take no space). Every header is the same
 * height and so is every row, so two measurements place the whole list: tapping a far-off day then scrolls
 * there exactly, without drawing every row first. `leading` is the height of anything above the first day (the
 * list's header, e.g. the spotlight row).
 */
export function agendaItemLayouts(
  sections: { data: unknown[] }[],
  headerHeight: number,
  rowHeight: number,
  leading = 0,
): ItemLayout[] {
  const out: ItemLayout[] = [];
  let offset = leading;
  const push = (length: number) => {
    out.push({ length, offset, index: out.length });
    offset += length;
  };
  for (const s of sections) {
    push(headerHeight);
    for (let i = 0; i < s.data.length; i++) push(rowHeight);
    push(0);
  }
  return out;
}
