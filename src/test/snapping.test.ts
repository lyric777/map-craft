import { describe, expect, it } from 'vitest';

import {
  createDefaultLayer,
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
} from '../lib/project';
import { findNearestSnapVertex, findObjectSnapTranslation } from '../map/snapping';

describe('vertex snapping', () => {
  it('finds the nearest vertex within the screen-distance threshold', () => {
    const layer = createDefaultLayer();
    const selected = createLineObject([[0, 0], [1, 1]]);
    const target = createPolygonObject([[10, 10], [20, 10], [20, 20], [10, 10]]);
    layer.objects.push(selected, target);

    expect(findNearestSnapVertex([layer], selected.id, { x: 18, y: 11 }, ([x, y]) => ({ x, y })))
      .toEqual([20, 10]);
    expect(findNearestSnapVertex([layer], selected.id, { x: 40, y: 40 }, ([x, y]) => ({ x, y })))
      .toBeNull();
  });

  it('ignores invisible, locked, selected, and free draw objects', () => {
    const selectedLayer = createDefaultLayer();
    const hiddenLayer = createDefaultLayer();
    const lockedLayer = createDefaultLayer();
    const selected = createLineObject([[1, 1], [2, 2]]);
    const freeDraw = createFreeDrawObject([[3, 3], [4, 4]]);
    const hiddenPoint = createPointObject([5, 5]);
    const lockedPoint = createPointObject([6, 6]);
    selectedLayer.objects.push(selected, freeDraw);
    hiddenLayer.visible = false;
    hiddenLayer.objects.push(hiddenPoint);
    lockedLayer.locked = true;
    lockedLayer.objects.push(lockedPoint);

    expect(findNearestSnapVertex(
      [selectedLayer, hiddenLayer, lockedLayer],
      selected.id,
      { x: 4, y: 4 },
      ([x, y]) => ({ x, y }),
    )).toBeNull();
  });

  it('returns the translation that snaps the closest vertex while moving a whole object', () => {
    const layer = createDefaultLayer();
    const movingLine = createLineObject([[8, 9], [12, 9]]);
    const targetLine = createLineObject([[10, 10], [20, 20]]);
    layer.objects.push(movingLine, targetLine);

    expect(findObjectSnapTranslation([layer], movingLine, ([x, y]) => ({ x, y }))).toEqual({
      deltaLng: 2,
      deltaLat: 1,
      targetCoordinate: [10, 10],
    });
  });

  it('does not snap whole free draw strokes', () => {
    const layer = createDefaultLayer();
    const freeDraw = createFreeDrawObject([[9, 9], [11, 11]]);
    layer.objects.push(freeDraw, createPointObject([10, 10]));

    expect(findObjectSnapTranslation([layer], freeDraw, ([x, y]) => ({ x, y }))).toBeNull();
  });
});
