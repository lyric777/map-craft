import { describe, expect, it } from 'vitest';

import { createDefaultLayer, createPolygonObject } from '../lib/project';
import { findSelectablePolygonAtCoordinate } from '../map/selection';

describe('polygon selection fallback', () => {
  it('finds an unlocked visible polygon by coordinate', () => {
    const layer = createDefaultLayer();
    const polygon = createPolygonObject([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    layer.objects.push(polygon);

    expect(findSelectablePolygonAtCoordinate([layer], [5, 5])).toEqual({
      objectId: polygon.id,
      layerId: layer.id,
    });
    expect(findSelectablePolygonAtCoordinate([layer], [20, 20])).toBeNull();
  });

  it('ignores hidden and locked layers', () => {
    const layer = createDefaultLayer();
    layer.objects.push(
      createPolygonObject([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ]),
    );

    layer.locked = true;
    expect(findSelectablePolygonAtCoordinate([layer], [5, 5])).toBeNull();

    layer.locked = false;
    layer.visible = false;
    expect(findSelectablePolygonAtCoordinate([layer], [5, 5])).toBeNull();
  });

  it('does not select through a polygon hole', () => {
    const layer = createDefaultLayer();
    const polygon = createPolygonObject([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    if (polygon.geometry.type === 'Polygon') {
      polygon.geometry.coordinates.push([
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
        [3, 3],
      ]);
    }
    layer.objects.push(polygon);

    expect(findSelectablePolygonAtCoordinate([layer], [5, 5])).toBeNull();
  });
});
