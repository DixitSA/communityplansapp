import { mixHex, tintedCanvas } from '../tint';

describe('mixHex', () => {
  it('blends between the two colors', () => {
    expect(mixHex('#ff0000', '#0000ff', 0)).toBe('#0000ff');
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#ff0000');
    expect(mixHex('#ff0000', '#000000', 0.5)).toBe('#800000');
    expect(mixHex('#ff0000', '#000000', 2)).toBe('#ff0000'); // clamped
  });
});

describe('tintedCanvas', () => {
  it('washes the canvas with a little of the flyer color', () => {
    expect(tintedCanvas('#a34929', '#f6f3ec', 'light')).toBe(mixHex('#a34929', '#f6f3ec', 0.12));
    expect(tintedCanvas('#a34929', '#101411', 'dark')).toBe(mixHex('#a34929', '#101411', 0.16));
  });
  it('keeps the plain canvas without a valid color', () => {
    expect(tintedCanvas(undefined, '#F6F3EC', 'light')).toBe('#F6F3EC');
    expect(tintedCanvas('red', '#F6F3EC', 'light')).toBe('#F6F3EC');
  });
});
