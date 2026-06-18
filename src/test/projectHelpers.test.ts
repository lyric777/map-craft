import { describe, expect, it } from 'vitest';

import {
  createDefaultLayer,
  createFreeDrawObject,
  createLineObject,
  getEditableVertices,
  processFreeDrawCoordinates,
  projectToFeatureCollection,
  simplifyFreeDrawCoordinates,
  smoothFreeDrawCoordinates,
  translateGeometry,
} from '../lib/project';

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

  it('does not expose editable vertices for free draw objects', () => {
    const object = createFreeDrawObject([
      [0, 0],
      [1, 1],
      [2, 1.5],
    ]);

    expect(getEditableVertices(object)).toEqual([]);
  });

  it('projects selection, hover, and free draw metadata into map features', () => {
    const layer = createDefaultLayer();
    const freeDraw = createFreeDrawObject([
      [0, 0],
      [1, 1],
    ]);
    const line = createLineObject([
      [2, 2],
      [3, 3],
    ]);
    layer.objects.push(freeDraw, line);

    const collection = projectToFeatureCollection([layer], freeDraw.id, line.id);
    const freeDrawFeature = collection.features.find((feature) => feature.id === freeDraw.id);
    const lineFeature = collection.features.find((feature) => feature.id === line.id);

    expect(freeDrawFeature?.properties).toMatchObject({
      objectId: freeDraw.id,
      layerId: layer.id,
      objectType: 'line',
      isFreeDraw: true,
      isSelected: true,
      isHovered: false,
    });

    expect(lineFeature?.properties).toMatchObject({
      objectId: line.id,
      layerId: layer.id,
      objectType: 'line',
      isFreeDraw: false,
      isSelected: false,
      isHovered: true,
    });
  });

  it('smooths and simplifies free draw coordinates while keeping endpoints', () => {
    const coordinates = [
      [0, 0],
      [0.00003, 0.0002],
      [0.00006, -0.0002],
      [0.0001, 0.00025],
      [0.0002, 0],
    ] as const;

    const smoothed = smoothFreeDrawCoordinates(coordinates as unknown as [number, number][]);
    const simplified = simplifyFreeDrawCoordinates(smoothed);
    const processed = processFreeDrawCoordinates(coordinates as unknown as [number, number][]);

    expect(smoothed[0]).toEqual([0, 0]);
    expect(smoothed.at(-1)).toEqual([0.0002, 0]);
    expect(simplified.length).toBeLessThanOrEqual(smoothed.length);
    expect(processed[0]).toEqual([0, 0]);
    expect(processed.at(-1)).toEqual([0.0002, 0]);
    expect(processed.length).toBeGreaterThanOrEqual(2);
  });
});
