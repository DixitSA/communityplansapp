import { milesBetween, neighborhoodFor } from '../neighborhoods';

describe('neighborhoodFor', () => {
  it('places real venues by coordinates', () => {
    expect(neighborhoodFor({ lat: 35.2272, lng: -80.8426 })?.name).toBe('Uptown'); // Trade & Tryon
    expect(neighborhoodFor({ lat: 35.2133, lng: -80.8576 })?.name).toBe('South End'); // Amos' Southend
    expect(neighborhoodFor({ lat: 35.2469, lng: -80.8026 })?.name).toBe('NoDa'); // 36th & N Davidson
    expect(neighborhoodFor({ lat: 35.2207, lng: -80.8122 })?.name).toBe('Plaza Midwood'); // Central & The Plaza
    expect(neighborhoodFor({ lat: 35.2425, lng: -80.8305 })?.name).toBe('Camp North End');
  });
  it('leaves places outside every neighborhood alone', () => {
    expect(neighborhoodFor({ lat: 35.1531, lng: -80.8268 })).toBeNull(); // SouthPark
    expect(neighborhoodFor({})).toBeNull();
    expect(neighborhoodFor({ lat: Number.NaN, lng: -80.8 })).toBeNull();
  });
  it("prefers the listing's own neighborhood name", () => {
    expect(neighborhoodFor({ neighborhood: 'noda', lat: 35.2272, lng: -80.8426 })?.name).toBe('NoDa');
    expect(neighborhoodFor({ neighborhood: 'Optimist Park' })?.name).toBe('Camp North End');
    // A name we don't know falls back to the coordinates.
    expect(neighborhoodFor({ neighborhood: 'Fourth Ward', lat: 35.2272, lng: -80.8426 })?.name).toBe('Uptown');
  });
});

it('measures miles', () => {
  // Uptown to NoDa is about 2.6 miles as the crow flies.
  expect(milesBetween(35.2271, -80.8431, 35.2475, -80.803)).toBeCloseTo(2.6, 0);
});
