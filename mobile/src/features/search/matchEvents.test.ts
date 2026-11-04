import { isPeopleQuery, matchEvents, searchShortcuts } from './matchEvents';

const events = [
  { title: 'Jazz Night', venue: 'Evening Muse', categoryLabel: 'Music', neighborhood: 'NoDa' },
  { title: 'Trivia', venue: 'Sugar Creek', categoryLabel: 'Games', neighborhood: 'Plaza Midwood' },
  { title: 'Market', venue: 'Camp North End', categoryLabel: 'Food' },
];

describe('matchEvents', () => {
  it('is case-insensitive on title', () => {
    expect(matchEvents(events, 'JAZZ').map((e) => e.title)).toEqual(['Jazz Night']);
  });
  it('matches venue, neighborhood and category', () => {
    expect(matchEvents(events, 'sugar')).toHaveLength(1);
    expect(matchEvents(events, 'plaza')).toHaveLength(1);
    expect(matchEvents(events, 'FOOD')).toHaveLength(1);
  });
  it('does not match other text', () => {
    expect(matchEvents(events, 'zzzz')).toEqual([]);
  });
  it('limits a shortcut chip to its own field', () => {
    const more = [...events, { title: 'Smart Startups Musical', venue: 'Hall', categoryLabel: 'Tech' }];
    expect(matchEvents(more, 'Music').map((e) => e.title)).toEqual(['Jazz Night', 'Smart Startups Musical']);
    expect(matchEvents(more, 'Music', 'category').map((e) => e.title)).toEqual(['Jazz Night']);
    expect(matchEvents(more, 'noda', 'neighborhood').map((e) => e.title)).toEqual(['Jazz Night']);
  });
  it('keeps input order and ignores blank queries', () => {
    expect(matchEvents(events, 'e').map((e) => e.title)).toEqual(['Jazz Night', 'Trivia', 'Market']);
    expect(matchEvents(events, '  ')).toEqual([]);
  });
});

describe('searchShortcuts', () => {
  const more = [
    ...events,
    { title: 'Show', venue: 'Neighborhood Theatre', categoryLabel: 'Music', neighborhood: 'NoDa' },
    { title: 'Gig', venue: 'Evening Muse', categoryLabel: 'Music', neighborhood: 'NoDa' },
    { title: 'Run', venue: 'Park', categoryLabel: 'Games', neighborhood: 'Plaza Midwood' },
  ];
  it('ranks by count and caps the lists', () => {
    const s = searchShortcuts(more, 1, 2);
    expect(s.neighborhoods).toEqual(['NoDa']);
    expect(s.categories).toEqual(['Music', 'Games']);
  });
  it('is empty with no events', () => {
    expect(searchShortcuts([])).toEqual({ neighborhoods: [], categories: [] });
  });
});

describe('isPeopleQuery', () => {
  it('switches on a leading @', () => {
    expect(isPeopleQuery('@sam')).toBe(true);
    expect(isPeopleQuery(' @sam')).toBe(true);
    expect(isPeopleQuery('sam@')).toBe(false);
    expect(isPeopleQuery('')).toBe(false);
  });
});
