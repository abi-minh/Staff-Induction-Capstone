import { describe, it, expect } from 'vitest';
import { parseMarkers, parsePaths } from './locations';

// Both parsers exist to keep a hand-edited or half-written meta value from
// crashing the map. Every case below is something the map must survive.

describe('parseMarkers', () => {
  it('reads well-formed markers', () => {
    const markers = parseMarkers(JSON.stringify([
      { id: 'm1', lat: -27.3, lng: 153.1, label: 'Meeting point', color: 'red' },
    ]));
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'm1', label: 'Meeting point', color: 'red' });
  });

  it('returns nothing for unusable input instead of throwing', () => {
    expect(parseMarkers(undefined)).toEqual([]);
    expect(parseMarkers('')).toEqual([]);
    expect(parseMarkers('nonsense')).toEqual([]);
    expect(parseMarkers('{"not":"an array"}')).toEqual([]);
  });

  it('drops entries with no usable coordinates', () => {
    const markers = parseMarkers(JSON.stringify([
      { id: 'ok', lat: 1, lng: 2 },
      { id: 'missing-lng', lat: 1 },
      { id: 'string-coords', lat: '1', lng: '2' },
      null,
      'not an object',
    ]));
    expect(markers.map((m) => m.id)).toEqual(['ok']);
  });

  it('falls back to red for a colour outside the palette', () => {
    const markers = parseMarkers(JSON.stringify([
      { id: 'm1', lat: 1, lng: 2, color: 'hotpink' },
    ]));
    expect(markers[0].color).toBe('red');
  });

  it('substitutes an id when one is missing, so React keys stay stable', () => {
    const markers = parseMarkers(JSON.stringify([{ lat: 1.5, lng: 2.5 }]));
    expect(markers[0].id).toBeTruthy();
  });
});

describe('parsePaths', () => {
  it('reads a well-formed line', () => {
    const paths = parsePaths(JSON.stringify([
      { id: 'p1', label: 'Where to fish', color: 'amber', points: [[1, 2], [3, 4]] },
    ]));
    expect(paths).toHaveLength(1);
    expect(paths[0].points).toEqual([[1, 2], [3, 4]]);
  });

  // A one-point line can't be drawn; the server drops these too, so the two
  // sides agree about what a line is.
  it('discards lines with fewer than two points', () => {
    expect(parsePaths(JSON.stringify([{ id: 'p1', points: [[1, 2]] }]))).toEqual([]);
    expect(parsePaths(JSON.stringify([{ id: 'p1', points: [] }]))).toEqual([]);
  });

  it('drops individual malformed points but keeps a line that still has two', () => {
    const paths = parsePaths(JSON.stringify([
      { id: 'p1', points: [[1, 2], ['x', 'y'], [3, 4], null] },
    ]));
    expect(paths).toHaveLength(1);
    expect(paths[0].points).toEqual([[1, 2], [3, 4]]);
  });

  it('returns nothing for unusable input instead of throwing', () => {
    expect(parsePaths(undefined)).toEqual([]);
    expect(parsePaths('nope')).toEqual([]);
    expect(parsePaths('{"not":"an array"}')).toEqual([]);
  });

  it('defaults a line to amber when the colour is unknown', () => {
    const paths = parsePaths(JSON.stringify([
      { id: 'p1', color: 'chartreuse', points: [[1, 2], [3, 4]] },
    ]));
    expect(paths[0].color).toBe('amber');
  });
});
