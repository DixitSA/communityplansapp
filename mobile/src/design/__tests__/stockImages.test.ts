import { stockImageFor } from '../stockImages';

describe('stockImageFor', () => {
  it('gives an event the same photo every time', () => {
    expect(stockImageFor('music', 'event-1')).toBeDefined();
    expect(stockImageFor('music', 'event-1')).toBe(stockImageFor('music', 'event-1'));
  });

  it('spreads events over the category\'s photos', () => {
    const picks = new Set(Array.from({ length: 30 }, (_, i) => stockImageFor('community', `event-${i}`)));
    expect(picks.size).toBe(3);
  });

  it('has nothing for an unknown category, so the generated art shows', () => {
    expect(stockImageFor('underwater_basket_weaving', 'event-1')).toBeUndefined();
  });
});
