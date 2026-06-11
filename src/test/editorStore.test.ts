import { beforeEach, describe, expect, it } from 'vitest';

import { createLineObject, createPointObject, createPolygonObject } from '../lib/project';
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
});
