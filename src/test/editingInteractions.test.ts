import type { Geometry, Position } from 'geojson';
import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultLayer,
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
  translateGeometry,
} from '../lib/project';
import { createEditingHandlers } from '../map/editingInteractions';
import type { MapInteractionBindings, WritableRef } from '../map/interactionBindings';
import type { MapcraftObject } from '../types/project';

const ref = <T,>(current: T): WritableRef<T> => ({ current });

const createMouseEvent = (x: number, y: number) => ({
  defaultPrevented: false,
  lngLat: { lng: x, lat: y },
  point: { x, y },
  preventDefault: vi.fn(),
});

const createBindings = (object: MapcraftObject) => {
  const layer = createDefaultLayer();
  layer.objects.push(object);
  const selectedObjectRef = ref<MapcraftObject | null>(null);
  const previewObjectGeometryRef = ref<Geometry | null>(null);
  const dragObjectIdRef = ref<string | null>(null);
  const hoverObjectIdRef = ref<string | null>(null);
  const dragVertexIndexRef = ref<number | null>(null);
  const hoverVertexIndexRef = ref<number | null>(null);
  const previewVerticesRef = ref<Position[] | null>(null);
  const snapCoordinateRef = ref<Position | null>(null);
  const objectDragStartRef = ref<Position | null>(null);
  const objectDragGeometryRef = ref<Geometry | null>(null);
  const dragMovedRef = ref(false);
  const map = {
    dragPan: {
      disable: vi.fn(),
      enable: vi.fn(),
      isEnabled: vi.fn(() => false),
    },
    getLayer: vi.fn(() => ({})),
    project: vi.fn(({ lng, lat }: { lng: number; lat: number }) => ({ x: lng, y: lat })),
    queryRenderedFeatures: vi.fn(() => []),
  };
  const selectObject = vi.fn((objectId: string | null) => {
    selectedObjectRef.current = objectId === object.id ? object : null;
  });
  const updateSelectedObjectGeometry = vi.fn();

  const bindings = {
    map,
    currentToolRef: ref<'move' | 'freeDraw'>('move'),
    projectLayersRef: ref([layer]),
    selectedLayerIdRef: ref<string | null>(layer.id),
    selectedObjectRef,
    geometryEditModeRef: ref(null),
    selectObjectRef: ref(selectObject),
    updateSelectedObjectGeometryRef: ref(updateSelectedObjectGeometry),
    addObjectToSelectedLayer: vi.fn(),
    replaceObjectsById: vi.fn(),
    draftCoordinatesRef: ref<Position[]>([]),
    closeToStartRef: ref(false),
    hoverSegmentIndexRef: ref<number | null>(null),
    hoverVertexIndexRef,
    dragVertexIndexRef,
    previewVerticesRef,
    snapCoordinateRef,
    hoverObjectIdRef,
    dragObjectIdRef,
    previewObjectGeometryRef,
    objectDragStartRef,
    objectDragGeometryRef,
    dragMovedRef,
    freeDrawScreenPointsRef: ref([]),
    isFreeDrawingRef: ref(false),
    isErasingRef: ref(false),
    eraserPreviewReplacementsRef: ref([]),
    setDraftCoordinates: vi.fn(),
    setHoverCoordinate: vi.fn(),
    setHoverSegmentIndex: vi.fn(),
    setHoverVertexIndex: vi.fn(),
    setDragVertexIndex: vi.fn(),
    setPreviewVertices: vi.fn(),
    setSnapCoordinate: vi.fn((coordinate: Position | null) => {
      snapCoordinateRef.current = coordinate;
    }),
    setHoverObjectId: vi.fn((objectId: string | null) => {
      hoverObjectIdRef.current = objectId;
    }),
    setDragObjectId: vi.fn((objectId: string | null) => {
      dragObjectIdRef.current = objectId;
    }),
    setPreviewObjectGeometry: vi.fn((geometry: Geometry | null) => {
      previewObjectGeometryRef.current = geometry;
    }),
    setFreeDrawScreenPoints: vi.fn(),
    setIsFreeDrawing: vi.fn(),
    setEraserPreviewReplacements: vi.fn(),
    setGeometryEditMode: vi.fn(),
    updateCanvasCursor: vi.fn(),
    resetVertexEditing: vi.fn(() => {
      dragObjectIdRef.current = null;
      hoverObjectIdRef.current = null;
      dragVertexIndexRef.current = null;
      hoverVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
      dragMovedRef.current = false;
      snapCoordinateRef.current = null;
    }),
    resetFreeDraw: vi.fn(),
  } as unknown as MapInteractionBindings;

  return {
    bindings,
    map,
    selectedObjectRef,
    selectObject,
    updateSelectedObjectGeometry,
  };
};

describe('unified editing interactions', () => {
  it('selects a free draw stroke through the shared click hit test', () => {
    const freeDraw = createFreeDrawObject([[0, 0], [20, 0]]);
    const setup = createBindings(freeDraw);
    const handlers = createEditingHandlers(setup.bindings);

    expect(handlers.handleMapClick(createMouseEvent(10, 5) as never)).toBe(true);
    expect(setup.selectObject).toHaveBeenCalledWith(freeDraw.id, expect.any(String));
    expect(setup.selectedObjectRef.current).toBe(freeDraw);
  });

  it('requires selection before dragging and moves a free draw stroke as one object', () => {
    const freeDraw = createFreeDrawObject([[0, 0], [20, 0]]);
    const setup = createBindings(freeDraw);
    const handlers = createEditingHandlers(setup.bindings);
    const firstMouseDown = createMouseEvent(10, 5);

    expect(handlers.handleMapMouseDown(firstMouseDown as never)).toBe(false);
    expect(setup.map.dragPan.disable).not.toHaveBeenCalled();

    handlers.handleMapClick(createMouseEvent(10, 5) as never);
    const secondMouseDown = createMouseEvent(10, 5);
    expect(handlers.handleMapMouseDown(secondMouseDown as never)).toBe(true);
    expect(secondMouseDown.preventDefault).toHaveBeenCalled();
    expect(setup.map.dragPan.disable).toHaveBeenCalled();

    expect(handlers.handleMouseMove(createMouseEvent(15, 8) as never)).toBe(true);
    expect(handlers.handleMouseUp()).toBe(true);
    expect(setup.updateSelectedObjectGeometry).toHaveBeenCalledWith({
      type: 'LineString',
      coordinates: [[5, 3], [25, 3]],
    });
  });

  it.each([
    ['point', createPointObject([10, 5]), { x: 10, y: 5 }],
    ['line', createLineObject([[0, 5], [20, 5]]), { x: 10, y: 5 }],
    [
      'polygon',
      createPolygonObject([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]),
      { x: 10, y: 5 },
    ],
  ])('selects and moves a %s through the same interaction path', (_name, object, point) => {
    const setup = createBindings(object as MapcraftObject);
    const handlers = createEditingHandlers(setup.bindings);

    handlers.handleMapClick(createMouseEvent(point.x, point.y) as never);
    expect(handlers.handleMapMouseDown(createMouseEvent(point.x, point.y) as never)).toBe(true);
    handlers.handleMouseMove(createMouseEvent(point.x + 5, point.y + 3) as never);
    handlers.handleMouseUp();

    expect(setup.updateSelectedObjectGeometry).toHaveBeenCalledWith(
      translateGeometry((object as MapcraftObject).geometry, 5, 3),
    );
  });

  it('uses the shared hit test to set and clear object hover', () => {
    const freeDraw = createFreeDrawObject([[0, 0], [20, 0]]);
    const setup = createBindings(freeDraw);
    const handlers = createEditingHandlers(setup.bindings);

    expect(handlers.handleMouseMove(createMouseEvent(10, 5) as never)).toBe(false);
    expect(
      (setup.bindings.hoverObjectIdRef as WritableRef<string | null>).current,
    ).toBe(freeDraw.id);

    handlers.handleMouseMove(createMouseEvent(100, 100) as never);
    expect(
      (setup.bindings.hoverObjectIdRef as WritableRef<string | null>).current,
    ).toBeNull();
  });
});
