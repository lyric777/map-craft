import { describe, expect, it } from 'vitest';

import { translateGeometry } from '../lib/project';

describe('project helpers', () => {
  it('translates point, line, and polygon geometries', () => {
    expect(
      translateGeometry(
        {
          type: 'Point',
          coordinates: [10, 20],
        },
        2,
        -3,
      ),
    ).toEqual({
      type: 'Point',
      coordinates: [12, 17],
    });

    expect(
      translateGeometry(
        {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        5,
        6,
      ),
    ).toEqual({
      type: 'LineString',
      coordinates: [
        [5, 6],
        [6, 7],
      ],
    });

    expect(
      translateGeometry(
        {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 0],
            ],
          ],
        },
        -1,
        4,
      ),
    ).toEqual({
      type: 'Polygon',
      coordinates: [
        [
          [-1, 4],
          [1, 4],
          [1, 6],
          [-1, 4],
        ],
      ],
    });
  });
});
