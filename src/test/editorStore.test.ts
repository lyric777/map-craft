import { beforeEach, describe, expect, it } from 'vitest';

import { createFreeDrawObject, createLineObject, createPointObject, createPolygonObject } from '../lib/project';
import { useEditorStore } from '../state/editorStore';

describe('editor store', () => {
  beforeEach(() => {
    useEditorStore.getState().newProject();
  });

  it('creates a default project with one layer', () => {
    const state = useEditorStore.getState();
    expect(state.project.layers).toHaveLength(1);
    expect(state.selectedLayerId).toBe(state.project.layers[0]?.id);
    expect(state.project.layers[0]?.locked).toBe(false);
    expect(state.project.basemapPreset).toBe('road');
  });

  it('changes the basemap preset and supports undo/redo', () => {
    const store = useEditorStore.getState();

    store.setBasemapPreset('terrain');
    expect(useEditorStore.getState().project.basemapPreset).toBe('terrain');

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.basemapPreset).toBe('road');

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.basemapPreset).toBe('terrain');
  });

  it('adds a polygon and supports undo/redo', () => {
    const store = useEditorStore.getState();
    store.addObjectToSelectedLayer(
      createPolygonObject([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    );

    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(1);
  });

  it('updates selected object style', () => {
    const store = useEditorStore.getState();
    store.addObjectToSelectedLayer(
      createPolygonObject([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    );

    store.updateSelectedObjectStyle({ fillColor: '#ff0000', opacity: 0.6 });

    const object = useEditorStore.getState().project.layers[0]?.objects[0];
    expect(object?.style.fillColor).toBe('#ff0000');
    expect(object?.style.opacity).toBe(0.6);
  });

  it('updates selected line geometry and supports undo/redo', () => {
    const store = useEditorStore.getState();
    store.addObjectToSelectedLayer(
      createLineObject([
        [0, 0],
        [1, 1],
      ]),
    );

    store.updateSelectedObjectGeometry({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [2, 3],
      ],
    });

    let object = useEditorStore.getState().project.layers[0]?.objects[0];
    expect(object?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [2, 3],
      ],
    });

    useEditorStore.getState().undo();
    object = useEditorStore.getState().project.layers[0]?.objects[0];
    expect(object?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });

    useEditorStore.getState().redo();
    object = useEditorStore.getState().project.layers[0]?.objects[0];
    expect(object?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [2, 3],
      ],
    });
  });

  it('supports point and line objects', () => {
    const store = useEditorStore.getState();
    store.addObjectToSelectedLayer(createPointObject([12, 34]));
    store.addObjectToSelectedLayer(
      createLineObject([
        [0, 0],
        [1, 1],
      ]),
    );

    const objects = useEditorStore.getState().project.layers[0]?.objects ?? [];
    expect(objects.map((object) => object.type)).toEqual(['point', 'line']);
  });

  it('preserves free draw metadata when updating selected geometry', () => {
    const store = useEditorStore.getState();
    store.addObjectToSelectedLayer(
      createFreeDrawObject([
        [0, 0],
        [1, 1],
      ]),
    );

    store.updateSelectedObjectGeometry({
      type: 'LineString',
      coordinates: [
        [2, 2],
        [4, 5],
      ],
    });

    const object = useEditorStore.getState().project.layers[0]?.objects[0];
    expect(object?.meta).toMatchObject({ drawingMode: 'freeDraw' });
    expect(object?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [2, 2],
        [4, 5],
      ],
    });
  });

  it('deletes multiple objects by id in one operation', () => {
    const store = useEditorStore.getState();
    const freeDraw = createFreeDrawObject([
      [0, 0],
      [1, 1],
    ]);
    const line = createLineObject([
      [2, 2],
      [3, 3],
    ]);
    store.addObjectToSelectedLayer(freeDraw);
    store.addObjectToSelectedLayer(line);

    store.deleteObjectsByIds([freeDraw.id, line.id]);

    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(0);
    expect(useEditorStore.getState().selectedObjectId).toBeNull();
  });

  it('replaces one free draw object with multiple segments in one operation', () => {
    const store = useEditorStore.getState();
    const freeDraw = createFreeDrawObject([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    store.addObjectToSelectedLayer(freeDraw);

    const left = createFreeDrawObject([
      [0, 0],
      [1, 0],
    ]);
    const right = createFreeDrawObject([
      [2, 0],
      [3, 0],
    ]);

    store.replaceObjectsById([{ objectId: freeDraw.id, objects: [left, right] }]);

    const objects = useEditorStore.getState().project.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(2);
    expect(objects.map((object) => object.id)).toEqual([left.id, right.id]);
    expect(useEditorStore.getState().selectedObjectId).toBeNull();
  });

  it('replaces split free draw segments by shared sourceObjectId in one operation', () => {
    const store = useEditorStore.getState();
    const firstSegment = createFreeDrawObject([
      [0, 0],
      [1, 0],
    ]);
    firstSegment.meta.sourceObjectId = 'root-free-draw';

    const secondSegment = createFreeDrawObject([
      [2, 0],
      [3, 0],
    ]);
    secondSegment.meta.sourceObjectId = 'root-free-draw';

    store.addObjectToSelectedLayer(firstSegment);
    store.addObjectToSelectedLayer(secondSegment);

    const remainingSegment = createFreeDrawObject([
      [2.5, 0],
      [3, 0],
    ]);
    remainingSegment.meta.sourceObjectId = 'root-free-draw';

    store.replaceObjectsById([{ objectId: 'root-free-draw', objects: [remainingSegment] }]);

    const objects = useEditorStore.getState().project.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(1);
    expect(objects[0]?.id).toBe(remainingSegment.id);
    expect(objects[0]?.meta.sourceObjectId).toBe('root-free-draw');
  });

  it('copies a selected object and pastes it into the current layer', () => {
    const store = useEditorStore.getState();
    const originalLayerId = store.selectedLayerId!;
    const originalPoint = createPointObject([12, 34]);
    store.addObjectToSelectedLayer(originalPoint);
    store.copySelectedObject();

    store.addLayer();
    const targetLayerId = useEditorStore.getState().selectedLayerId!;
    useEditorStore.getState().pasteClipboardToSelectedLayer();

    const layers = useEditorStore.getState().project.layers;
    const originalLayer = layers.find((layer) => layer.id === originalLayerId)!;
    const targetLayer = layers.find((layer) => layer.id === targetLayerId)!;
    const pastedPoint = targetLayer.objects[0];

    expect(useEditorStore.getState().clipboardObject?.id).toBe(originalPoint.id);
    expect(originalLayer.objects).toHaveLength(1);
    expect(targetLayer.objects).toHaveLength(1);
    expect(pastedPoint?.id).not.toBe(originalPoint.id);
    expect(pastedPoint?.geometry.type).toBe('Point');
    expect((pastedPoint?.geometry as { coordinates: number[] }).coordinates).not.toEqual(
      (originalPoint.geometry as { coordinates: number[] }).coordinates,
    );
    expect(useEditorStore.getState().selectedObjectId).toBe(pastedPoint?.id);
  });

  it('creates independent duplicates and pasted copies of free draw segments', () => {
    const store = useEditorStore.getState();
    const freeDraw = createFreeDrawObject([
      [0, 0],
      [1, 0],
    ]);
    freeDraw.meta.sourceObjectId = 'root-free-draw';
    store.addObjectToSelectedLayer(freeDraw);

    store.duplicateSelectedObject();
    let objects = useEditorStore.getState().project.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(2);
    expect(objects[1]?.meta.sourceObjectId).toBeUndefined();

    useEditorStore.getState().selectObject(freeDraw.id, useEditorStore.getState().selectedLayerId);
    useEditorStore.getState().copySelectedObject();
    useEditorStore.getState().pasteClipboardToSelectedLayer();

    objects = useEditorStore.getState().project.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(3);
    expect(objects[2]?.meta.sourceObjectId).toBeUndefined();
  });

  it('locks a layer and clears the current selection inside that layer', () => {
    const store = useEditorStore.getState();
    const point = createPointObject([12, 34]);
    store.addObjectToSelectedLayer(point);

    const layerId = useEditorStore.getState().selectedLayerId!;
    store.toggleLayerLock(layerId);

    const layer = useEditorStore.getState().project.layers.find((candidate) => candidate.id === layerId);
    expect(layer?.locked).toBe(true);
    expect(useEditorStore.getState().selectedObjectId).toBeNull();

    useEditorStore.getState().toggleLayerLock(layerId);
    expect(
      useEditorStore.getState().project.layers.find((candidate) => candidate.id === layerId)?.locked,
    ).toBe(false);
  });

  it('undoes and redoes clipboard paste', () => {
    const store = useEditorStore.getState();
    const originalPoint = createPointObject([12, 34]);
    store.addObjectToSelectedLayer(originalPoint);
    store.copySelectedObject();

    useEditorStore.getState().pasteClipboardToSelectedLayer();
    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(2);
  });

  it('undoes and redoes layer visibility and lock toggles', () => {
    const store = useEditorStore.getState();
    const layerId = store.selectedLayerId!;

    store.toggleLayerVisibility(layerId);
    store.toggleLayerLock(layerId);

    let layer = useEditorStore.getState().project.layers.find((candidate) => candidate.id === layerId);
    expect(layer?.visible).toBe(false);
    expect(layer?.locked).toBe(true);

    useEditorStore.getState().undo();
    layer = useEditorStore.getState().project.layers.find((candidate) => candidate.id === layerId);
    expect(layer?.visible).toBe(false);
    expect(layer?.locked).toBe(false);

    useEditorStore.getState().undo();
    layer = useEditorStore.getState().project.layers.find((candidate) => candidate.id === layerId);
    expect(layer?.visible).toBe(true);
    expect(layer?.locked).toBe(false);

    useEditorStore.getState().redo();
    useEditorStore.getState().redo();
    layer = useEditorStore.getState().project.layers.find((candidate) => candidate.id === layerId);
    expect(layer?.visible).toBe(false);
    expect(layer?.locked).toBe(true);
  });

  it('undoes and redoes layer add, rename, and reorder', () => {
    const store = useEditorStore.getState();
    const originalLayerId = store.selectedLayerId!;

    store.addLayer();
    const newLayerId = useEditorStore.getState().selectedLayerId!;
    useEditorStore.getState().renameLayer(newLayerId, 'Reference');
    useEditorStore.getState().reorderLayer(newLayerId, 'down');

    let layers = useEditorStore.getState().project.layers;
    expect(layers).toHaveLength(2);
    expect(layers[0]?.id).toBe(originalLayerId);
    expect(layers[1]?.name).toBe('Reference');

    useEditorStore.getState().undo();
    layers = useEditorStore.getState().project.layers;
    expect(layers[0]?.id).toBe(newLayerId);

    useEditorStore.getState().undo();
    layers = useEditorStore.getState().project.layers;
    expect(layers[0]?.name).toBe('Layer 2');

    useEditorStore.getState().undo();
    layers = useEditorStore.getState().project.layers;
    expect(layers).toHaveLength(1);

    useEditorStore.getState().redo();
    useEditorStore.getState().redo();
    useEditorStore.getState().redo();
    layers = useEditorStore.getState().project.layers;
    expect(layers).toHaveLength(2);
    expect(layers[1]?.name).toBe('Reference');
    expect(layers[0]?.id).toBe(originalLayerId);
  });
});
