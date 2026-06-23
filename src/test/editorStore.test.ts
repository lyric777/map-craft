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
});
