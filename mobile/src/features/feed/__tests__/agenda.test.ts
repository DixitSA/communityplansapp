import { agendaItemLayouts, dayMetaFrom, eventDay, formatAgendaTitle, groupByDay, sectionIndexForDay } from '../agenda';

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
