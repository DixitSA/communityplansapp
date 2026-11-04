import { isPeopleQuery, matchEvents } from './matchEvents';

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
  it('keeps input order and ignores blank queries', () => {
    expect(matchEvents(events, 'e').map((e) => e.title)).toEqual(['Jazz Night', 'Trivia', 'Market']);
    expect(matchEvents(events, '  ')).toEqual([]);
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
