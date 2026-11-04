import { stockImageFor } from '@/design/stockImages';
import { type AgendaEvent, assignStockVariants, assignStockVariantsByDay,agendaDetail,agendaHeadline, agendaItemLayouts, dayMetaFrom, eventDay, formatAgendaTitle, groupByDay, hasEnded, isLive, sectionIndexForDay } from '../agenda';

const ev = (id: string, y: number, mo: number, d: number, h: number, extra: { day?: string; friendsGoing?: number } = {}) => ({
  id,
  startsAt: new Date(y, mo - 1, d, h),
  friendsGoing: 0,
  ...extra,
});

const events = [
  ev('late', 2026, 10, 30, 21),
  ev('now', 2026, 10, 29, 18),
  ev('early', 2026, 10, 30, 9, { friendsGoing: 2 }),
  ev('later', 2026, 11, 2, 12),
];

describe('groupByDay', () => {
  const sections = groupByDay(events, '2026-10-29');

  it('makes one section per local day, earliest first, with no empty days in between', () => {
    expect(sections.map((s) => s.day)).toEqual(['2026-10-29', '2026-10-30', '2026-11-02']);
    expect(sections.map((s) => s.data.map((e) => e.id))).toEqual([['now'], ['early', 'late'], ['later']]);
  });

  it('titles sections "Thu, Oct 29 · 1 event" and marks only today', () => {
    expect(sections[0].title).toBe('Thu, Oct 29 · 1 event');
    expect(sections[1].title).toBe('Fri, Oct 30 · 2 events');
    expect(sections.map((s) => s.isToday)).toEqual([true, false, false]);
  });

  it('prefers the server-supplied day over the device-derived one', () => {
    // 11 PM local that the city's clock already calls the next day.
    const late = ev('x', 2026, 10, 29, 23, { day: '2026-10-30' });
    expect(eventDay(late)).toBe('2026-10-30');
    expect(groupByDay([late], '2026-10-29')[0].day).toBe('2026-10-30');
  });

  it('is empty for no events', () => {
    expect(groupByDay([], '2026-10-29')).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = [...events];
    groupByDay(events, '2026-10-29');
    expect(events).toEqual(copy);
  });
});

describe('formatAgendaTitle', () => {
  it('handles a month boundary and singular/plural', () => {
    expect(formatAgendaTitle('2026-11-01', 1)).toBe('Sun, Nov 1 · 1 event');
    expect(formatAgendaTitle('2026-11-01', 0)).toBe('Sun, Nov 1 · 0 events');
  });
});

describe('dayMetaFrom', () => {
  it('counts events per day and flags days with friends going', () => {
    expect(dayMetaFrom(events)).toEqual({
      '2026-10-29': { count: 1, friendsGoing: false },
      '2026-10-30': { count: 2, friendsGoing: true },
      '2026-11-02': { count: 1, friendsGoing: false },
    });
  });
});

describe('sectionIndexForDay', () => {
  const sections = groupByDay(events, '2026-10-29');

  it('finds the day itself', () => {
    expect(sectionIndexForDay(sections, '2026-10-30')).toBe(1);
  });

  it('falls forward to the next day that has events', () => {
    expect(sectionIndexForDay(sections, '2026-10-31')).toBe(2);
    expect(sectionIndexForDay(sections, '2026-11-01')).toBe(2);
  });

  it('goes to the top for a day before the list, and -1 past the end', () => {
    expect(sectionIndexForDay(sections, '2026-10-27')).toBe(0);
    expect(sectionIndexForDay(sections, '2026-11-03')).toBe(-1);
    expect(sectionIndexForDay([], '2026-10-29')).toBe(-1);
  });
});

describe('agendaItemLayouts', () => {
  const sections = [
    { day: '2026-10-29', data: [{ id: 'a' }, { id: 'b' }] },
    { day: '2026-10-30', data: [{ id: 'c' }] },
  ];
  const header = () => 40;

  it('places headers, rows and empty footers back to back', () => {
    const layouts = agendaItemLayouts(sections, header, () => 100);
    expect(layouts.map((l) => [l.offset, l.length])).toEqual([
      [0, 40], // day 1 header
      [40, 100],
      [140, 100],
      [240, 0], // day 1 footer
      [240, 40], // day 2 header
      [280, 100],
      [380, 0],
    ]);
    expect(layouts.map((l) => l.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('uses each row\'s own height', () => {
    const heights: Record<string, number> = { a: 100, b: 120, c: 90 };
    const layouts = agendaItemLayouts(sections, header, (e) => heights[e.id]);
    expect(layouts.map((l) => l.offset)).toEqual([0, 40, 140, 260, 260, 300, 390]);
  });

  it('starts after the list header', () => {
    const layouts = agendaItemLayouts([sections[1]], header, () => 100, 300);
    expect(layouts.map((l) => l.offset)).toEqual([300, 340, 440]);
  });

  it('is empty for no sections', () => {
    expect(agendaItemLayouts([], header, () => 100)).toEqual([]);
  });
});

describe('day headers', () => {
  const today = '2026-10-31';
  const at = (h: number) => new Date(2026, 9, 31, h, 0);

  it('gives today a mood for the time of day', () => {
    expect(agendaHeadline(today, today, at(9))).toBe('this morning');
    expect(agendaHeadline(today, today, at(14))).toBe('this afternoon');
    expect(agendaHeadline(today, today, at(20))).toBe('tonight');
  });

  it('names tomorrow and the rest of the week, then falls back to the date', () => {
    expect(agendaHeadline('2026-11-01', today, at(20))).toBe('tomorrow'); // across the clock change
    expect(agendaHeadline('2026-11-05', today, at(20))).toBe('Thursday');
    expect(agendaHeadline('2026-11-07', today, at(20))).toBe('Sat, Nov 7');
  });

  it('keeps the date in the detail line unless the headline is the date', () => {
    expect(agendaDetail('2026-11-05', 'Thursday', 9)).toBe('Thu, Nov 5 · 9 events');
    expect(agendaDetail('2026-11-07', 'Sat, Nov 7', 1)).toBe('1 event');
    expect(agendaDetail('2026-10-31', 'tonight', 8, 3)).toBe('Sat, Oct 31 · 8 events · 3 live');
  });
});

describe('live and ended', () => {
  const now = new Date(2026, 9, 31, 20, 0);
  const ev = (startH: number, endH?: number) => ({
    startsAt: new Date(2026, 9, 31, startH, 0),
    endsAt: endH === undefined ? undefined : new Date(2026, 9, 31, endH, 0),
  });

  it('is live between its start and end', () => {
    expect(isLive(ev(19, 22), now)).toBe(true);
    expect(isLive(ev(21, 23), now)).toBe(false);
    expect(isLive(ev(18), now)).toBe(true); // no end: three hours assumed
    expect(isLive(ev(16), now)).toBe(false);
  });

  it('has ended once its end (or three hours) has passed', () => {
    expect(hasEnded(ev(8, 12), now)).toBe(true);
    expect(hasEnded(ev(16), now)).toBe(true);
    expect(hasEnded(ev(19, 22), now)).toBe(false);
  });
});

describe('assignStockVariants', () => {
  const music = (id: string, extra: object = {}): AgendaEvent & { id: string; interest: string } => ({ id, interest: 'music', startsAt: new Date(2026, 9, 30, 12), friendsGoing: 0, ...extra });
  const photo = (e: { id: string; interest: string; stockVariant?: number | null }) => stockImageFor(e.interest, e.id, e.stockVariant);

  it('never repeats a stock photo within a category, then falls back to art', () => {
    const out = assignStockVariants(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => music(id)));
    const shown = out.map(photo).filter((p) => p !== undefined);
    expect(shown).toHaveLength(3);
    expect(new Set(shown).size).toBe(3);
    expect(out.filter((e) => e.stockVariant === null)).toHaveLength(3);
  });

  it('ignores events with their own image and other categories', () => {
    const own = music('own', { imageUrl: 'https://x/y.jpg' });
    const out = assignStockVariants([own, music('a'), { ...music('b'), interest: 'comedy' }]);
    expect(out[0]).toBe(own);
    expect(out[2].stockVariant).toBeUndefined();
  });

  it('is applied per day, keeping the input order', () => {
    const input = [music('a'), music('e', { startsAt: new Date(2026, 9, 31, 12) }), music('b'), music('c'), music('d')];
    const out = assignStockVariantsByDay(input);
    expect(out.map((e) => e.id)).toEqual(['a', 'e', 'b', 'c', 'd']);
    expect(out.filter((e) => e.stockVariant === null)).toHaveLength(1); // the 30th has four, one too many
    expect(out[1].stockVariant).toBeUndefined(); // the 31st's only event keeps its own pick
  });

  it('decides photos before filtering, so dropping an event never moves a photo', () => {
    const day = [music('a'), music('b'), music('c'), music('d')];
    const before = assignStockVariantsByDay(day);
    const afterDrop = before.slice(1); // e.g. 'a' ended or was filtered out
    expect(afterDrop.map(photo)).toEqual(before.slice(1).map(photo));
  });
});
