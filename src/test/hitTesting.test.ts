import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultLayer,
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
} from '../lib/project';
import { getPointToSegmentDistance, hitTestObject } from '../map/hitTesting';

const createMap = (renderedFeatures: unknown[] = []) => ({
  getLayer: vi.fn(() => ({})),
  project: vi.fn(({ lng, lat }: { lng: number; lat: number }) => ({ x: lng, y: lat })),
  queryRenderedFeatures: vi.fn(() => renderedFeatures),
});

describe('unified object hit testing', () => {
  it('uses the old single-point rendered query as the primary path', () => {
    const layer = createDefaultLayer();
    const line = createLineObject([[0, 0], [10, 0]]);
    layer.objects.push(line);
    const map = createMap([
      { properties: { objectId: line.id, layerId: layer.id } },
    ]);

    expect(hitTestObject(map as never, [layer], { x: 5, y: 20 }, [5, 20])).toEqual({
      objectId: line.id,
      layerId: layer.id,
      objectType: 'line',
      source: 'rendered',
    });
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith([5, 20], expect.any(Object));
  });

  it('accepts a rendered 3D extrusion hit before ground geometry fallback', () => {
    const layer = createDefaultLayer();
    const polygon = createPolygonObject([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]);
    polygon.style.extrusionHeight = 10_000;
    layer.objects.push(polygon);
    const map = createMap([
      { properties: { objectId: polygon.id, layerId: layer.id } },
    ]);

    expect(hitTestObject(map as never, [layer], { x: 100, y: 100 }, [100, 100])).toEqual({
      objectId: polygon.id,
      layerId: layer.id,
      objectType: 'polygon',
      source: 'rendered',
    });
  });

  it('uses geometry safely before editor style layers finish loading', () => {
    const layer = createDefaultLayer();
    const point = createPointObject([0, 0]);
    layer.objects.push(point);
    const map = createMap();
    map.getLayer.mockReturnValue(undefined as never);

    expect(hitTestObject(map as never, [layer], { x: 0, y: 0 }, [0, 0])?.objectId).toBe(point.id);
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it('falls back to point, line, free draw, and polygon geometry', () => {
    const pointLayer = createDefaultLayer();
    const point = createPointObject([10, 10]);
    pointLayer.objects.push(point);
    expect(hitTestObject(createMap() as never, [pointLayer], { x: 20, y: 10 }, [20, 10])?.objectId)
      .toBe(point.id);

    const lineLayer = createDefaultLayer();
    const line = createLineObject([[0, 0], [20, 0]]);
    lineLayer.objects.push(line);
    expect(hitTestObject(createMap() as never, [lineLayer], { x: 10, y: 7 }, [10, 7])?.objectId)
      .toBe(line.id);

    const freeDrawLayer = createDefaultLayer();
    const freeDraw = createFreeDrawObject([[0, 0], [20, 0]]);
    freeDrawLayer.objects.push(freeDraw);
    expect(
      hitTestObject(createMap() as never, [freeDrawLayer], { x: 10, y: 7 }, [10, 7])?.objectId,
    ).toBe(freeDraw.id);

    const polygonLayer = createDefaultLayer();
    const polygon = createPolygonObject([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]);
    polygonLayer.objects.push(polygon);
    expect(
      hitTestObject(createMap() as never, [polygonLayer], { x: 10, y: 10 }, [10, 10])?.objectId,
    ).toBe(polygon.id);
  });

  it('respects polygon holes and still hits polygon edges', () => {
    const layer = createDefaultLayer();
    const polygon = createPolygonObject([[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]]);
    if (polygon.geometry.type === 'Polygon') {
      polygon.geometry.coordinates.push([[5, 5], [35, 5], [35, 35], [5, 35], [5, 5]]);
    }
    layer.objects.push(polygon);

    expect(hitTestObject(createMap() as never, [layer], { x: 20, y: 20 }, [20, 20])).toBeNull();
    expect(
      hitTestObject(createMap() as never, [layer], { x: 5, y: 10 }, [5, 10])?.objectId,
    ).toBe(polygon.id);
  });

  it('ignores hidden and locked layers and uses project stacking order for fallback', () => {
    const topLayer = createDefaultLayer();
    const bottomLayer = createDefaultLayer();
    const older = createPointObject([0, 0]);
    const newer = createPointObject([0, 0]);
    const bottom = createPointObject([0, 0]);
    topLayer.objects.push(older, newer);
    bottomLayer.objects.push(bottom);

    expect(
      hitTestObject(createMap() as never, [topLayer, bottomLayer], { x: 0, y: 0 }, [0, 0])
        ?.objectId,
    ).toBe(newer.id);

    topLayer.locked = true;
    expect(
      hitTestObject(createMap() as never, [topLayer, bottomLayer], { x: 0, y: 0 }, [0, 0])
        ?.objectId,
    ).toBe(bottom.id);

    bottomLayer.visible = false;
    expect(
      hitTestObject(createMap() as never, [topLayer, bottomLayer], { x: 0, y: 0 }, [0, 0]),
    ).toBeNull();
  });

  it('ignores rendered hits whose canonical layer is locked', () => {
    const lockedLayer = createDefaultLayer();
    lockedLayer.locked = true;
    const locked = createPointObject([0, 0]);
    lockedLayer.objects.push(locked);
    const visibleLayer = createDefaultLayer();
    const visible = createPointObject([0, 0]);
    visibleLayer.objects.push(visible);
    const map = createMap([
      { properties: { objectId: locked.id, layerId: lockedLayer.id } },
      { properties: { objectId: visible.id, layerId: visibleLayer.id } },
    ]);

    expect(
      hitTestObject(map as never, [lockedLayer, visibleLayer], { x: 0, y: 0 }, [0, 0])?.objectId,
    ).toBe(visible.id);
  });

  it('calculates point-to-segment distance for geometric line hits', () => {
    expect(getPointToSegmentDistance({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }))
      .toBe(4);
    expect(getPointToSegmentDistance({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }))
      .toBe(5);
  });
});
