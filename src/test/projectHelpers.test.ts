import { describe, expect, it } from 'vitest';

import {
  eraseFreeDrawObject,
  eraseLineStringCoordinates,
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

  it('splits free draw coordinates into surviving segments when erased through the middle', () => {
    const coordinates = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ] as [number, number][];
    const projected = coordinates.map(([x, y]) => ({ x, y }));
    const eraserPath = [{ x: 2, y: 0 }];

    const result = eraseLineStringCoordinates(coordinates, projected, eraserPath, 0.25);

    expect(result.didErase).toBe(true);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]![0]).toEqual([0, 0]);
    expect(result.segments[0]!.at(-1)![0]).toBeCloseTo(1.75, 2);
    expect(result.segments[1]![0][0]).toBeCloseTo(2.25, 2);
    expect(result.segments[1]!.at(-1)).toEqual([4, 0]);
  });

  it('trims only the intersecting portion of a long segment instead of deleting the whole segment', () => {
    const coordinates = [
      [0, 0],
      [10, 0],
    ] as [number, number][];
    const projected = coordinates.map(([x, y]) => ({ x, y }));
    const eraserPath = [{ x: 5, y: 0 }];

    const result = eraseLineStringCoordinates(coordinates, projected, eraserPath, 1);

    expect(result.didErase).toBe(true);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]![0]).toEqual([0, 0]);
    expect(result.segments[0]![1][0]).toBeCloseTo(4, 2);
    expect(result.segments[1]![0][0]).toBeCloseTo(6, 2);
    expect(result.segments[1]![1]).toEqual([10, 0]);
  });

  it('preserves free draw style and metadata when erasing into smaller strokes', () => {
    const object = createFreeDrawObject([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ]);
    object.style.strokeColor = '#123456';
    object.style.strokeWidth = 5;

    const segments = eraseFreeDrawObject(
      object,
      ([x, y]) => ({ x, y }),
      [{ x: 2, y: 0 }],
      0.25,
    );

    expect(segments).toHaveLength(2);
    expect(
      segments?.every((segment) => (segment.meta as Record<string, unknown>)['drawingMode'] === 'freeDraw'),
    ).toBe(true);
    expect(
      segments?.every((segment) => (segment.meta as Record<string, unknown>)['sourceObjectId'] === object.id),
    ).toBe(true);
    expect(segments?.every((segment) => segment.style.strokeColor === '#123456')).toBe(true);
    expect(segments?.map((segment) => segment.geometry.type)).toEqual(['LineString', 'LineString']);
    expect(segments?.[0]?.geometry.coordinates[0]).toEqual([0, 0]);
    expect(segments?.[0]?.geometry.coordinates.at(-1)?.[0]).toBeCloseTo(1.75, 2);
    expect(segments?.[1]?.geometry.coordinates[0]?.[0]).toBeCloseTo(2.25, 2);
    expect(segments?.[1]?.geometry.coordinates.at(-1)).toEqual([4, 0]);
  });

  it('keeps the original sourceObjectId when erasing an already-split free draw segment again', () => {
    const object = createFreeDrawObject([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ]);

    const firstPass = eraseFreeDrawObject(
      object,
      ([x, y]) => ({ x, y }),
      [{ x: 3, y: 0 }],
      0.25,
    );

    const leftSegment = firstPass?.[0];
    expect(leftSegment).toBeDefined();

    const secondPass = eraseFreeDrawObject(
      leftSegment!,
      ([x, y]) => ({ x, y }),
      [{ x: 0.5, y: 0 }],
      0.2,
    );

    expect(secondPass).toHaveLength(2);
    expect(
      (secondPass?.[0].meta as Record<string, unknown>)['sourceObjectId'],
    ).toBe(object.id);
    expect(
      (secondPass?.[1].meta as Record<string, unknown>)['sourceObjectId'],
    ).toBe(object.id);
  });
});
