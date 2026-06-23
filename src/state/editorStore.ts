import type { MapcraftLayer, MapcraftObject, MapcraftProject, ToolId } from '../types/project';
import { create } from 'zustand';

import { createDefaultLayer, createEmptyProject, duplicateObject, getSourceObjectId } from '../lib/project';

interface EditorSnapshot {
  project: MapcraftProject;
  selectedLayerId: string | null;
  selectedObjectId: string | null;
}

interface EditorState extends EditorSnapshot {
  currentTool: ToolId;
  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
  setCurrentTool: (tool: ToolId) => void;
  setViewport: (viewport: MapcraftProject['viewport']) => void;
  newProject: () => void;
  openProject: (project: MapcraftProject) => void;
  addLayer: () => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  reorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  selectLayer: (layerId: string | null) => void;
  selectObject: (objectId: string | null, layerId?: string | null) => void;
  addObjectToSelectedLayer: (object: MapcraftObject) => void;
  updateSelectedObjectStyle: (style: Partial<MapcraftObject['style']>) => void;
  updateSelectedObjectGeometry: (geometry: MapcraftObject['geometry']) => void;
  deleteObjectsByIds: (objectIds: string[]) => void;
  replaceObjectsById: (replacements: Array<{ objectId: string; objects: MapcraftObject[] }>) => void;
  deleteSelectedObject: () => void;
  duplicateSelectedObject: () => void;
  undo: () => void;
  redo: () => void;
}

const buildSnapshot = (state: EditorState): EditorSnapshot => ({
  project: structuredClone(state.project),
  selectedLayerId: state.selectedLayerId,
  selectedObjectId: state.selectedObjectId,
});

const createInitialState = (): EditorSnapshot => {
  const project = createEmptyProject();
  return {
    project,
    selectedLayerId: project.layers[0]?.id ?? null,
    selectedObjectId: null,
  };
};

const mutateWithHistory = (
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  mutator: (draft: EditorSnapshot) => void,
) => {
  const current = get();
  const next = buildSnapshot(current);
  mutator(next);

  set({
    ...next,
    historyPast: [...current.historyPast, buildSnapshot(current)],
    historyFuture: [],
  });
};

export const useEditorStore = create<EditorState>((set, get) => ({
  ...createInitialState(),
  currentTool: 'polygon',
  historyPast: [],
  historyFuture: [],
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setViewport: (viewport) =>
    set((state) => {
      const [currentLng, currentLat] = state.project.viewport.center;
      const [nextLng, nextLat] = viewport.center;
      const sameViewport =
        currentLng === nextLng &&
        currentLat === nextLat &&
        state.project.viewport.zoom === viewport.zoom;

      if (sameViewport) {
        return state;
      }

      return {
        project: {
          ...state.project,
          viewport,
        },
      };
    }),
  newProject: () => {
    const initial = createInitialState();
    set({
      ...initial,
      currentTool: 'polygon',
      historyPast: [],
      historyFuture: [],
    });
  },
  openProject: (project) => {
    const firstLayerId = project.layers[0]?.id ?? null;
    set({
      project,
      selectedLayerId: firstLayerId,
      selectedObjectId: null,
      currentTool: 'polygon',
      historyPast: [],
      historyFuture: [],
    });
  },
  addLayer: () =>
    mutateWithHistory(set, get, (draft) => {
      const nextLayer = createDefaultLayer(`Layer ${draft.project.layers.length + 1}`);
      draft.project.layers.unshift(nextLayer);
      draft.selectedLayerId = nextLayer.id;
      draft.selectedObjectId = null;
    }),
  renameLayer: (layerId, name) =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === layerId);
      if (layer) {
        layer.name = name || 'Untitled Layer';
      }
    }),
  toggleLayerVisibility: (layerId) =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === layerId);
      if (layer) {
        layer.visible = !layer.visible;
      }
    }),
  reorderLayer: (layerId, direction) =>
    mutateWithHistory(set, get, (draft) => {
      const index = draft.project.layers.findIndex((candidate) => candidate.id === layerId);
      if (index === -1) {
        return;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= draft.project.layers.length) {
        return;
      }

      const [layer] = draft.project.layers.splice(index, 1);
      draft.project.layers.splice(targetIndex, 0, layer);
    }),
  selectLayer: (layerId) => set({ selectedLayerId: layerId }),
  selectObject: (objectId, layerId) =>
    set({
      selectedObjectId: objectId,
      selectedLayerId: layerId ?? get().selectedLayerId,
      currentTool: objectId ? 'move' : get().currentTool,
    }),
  addObjectToSelectedLayer: (object) =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === draft.selectedLayerId);
      if (!layer) {
        return;
      }

      layer.objects.push(object);
      draft.selectedObjectId = object.id;
    }),
  updateSelectedObjectStyle: (style) =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === draft.selectedLayerId);
      const object = layer?.objects.find((candidate) => candidate.id === draft.selectedObjectId);
      if (object) {
        object.style = { ...object.style, ...style };
      }
    }),
  updateSelectedObjectGeometry: (geometry) =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === draft.selectedLayerId);
      const object = layer?.objects.find((candidate) => candidate.id === draft.selectedObjectId);
      if (object) {
        object.geometry = structuredClone(geometry);
      }
    }),
  deleteObjectsByIds: (objectIds) =>
    mutateWithHistory(set, get, (draft) => {
      if (objectIds.length === 0) {
        return;
      }

      const deleted = new Set(objectIds);
      draft.project.layers.forEach((layer) => {
        layer.objects = layer.objects.filter((candidate) => !deleted.has(candidate.id));
      });

      if (draft.selectedObjectId && deleted.has(draft.selectedObjectId)) {
        draft.selectedObjectId = null;
      }
    }),
  replaceObjectsById: (replacements) =>
    mutateWithHistory(set, get, (draft) => {
      if (replacements.length === 0) {
        return;
      }

      const replacementMap = new Map(replacements.map((entry) => [entry.objectId, entry.objects]));
      draft.project.layers.forEach((layer) => {
        const consumedSourceIds = new Set<string>();
        layer.objects = layer.objects.flatMap((candidate) => {
          const sourceObjectId = getSourceObjectId(candidate);
          const replacementObjects = replacementMap.get(sourceObjectId) ?? replacementMap.get(candidate.id);

          if (!replacementObjects) {
            return [candidate];
          }

          if (consumedSourceIds.has(sourceObjectId)) {
            return [];
          }

          consumedSourceIds.add(sourceObjectId);
          return replacementObjects;
        });
      });

      if (
        draft.selectedObjectId &&
        draft.project.layers.every((layer) =>
          layer.objects.every((candidate) => candidate.id !== draft.selectedObjectId),
        )
      ) {
        draft.selectedObjectId = null;
      }
    }),
  deleteSelectedObject: () =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === draft.selectedLayerId);
      if (!layer || !draft.selectedObjectId) {
        return;
      }

      layer.objects = layer.objects.filter((candidate) => candidate.id !== draft.selectedObjectId);
      draft.selectedObjectId = null;
    }),
  duplicateSelectedObject: () =>
    mutateWithHistory(set, get, (draft) => {
      const layer = draft.project.layers.find((candidate) => candidate.id === draft.selectedLayerId);
      const object = layer?.objects.find((candidate) => candidate.id === draft.selectedObjectId);
      if (!layer || !object) {
        return;
      }

      const clone = duplicateObject(object);
      layer.objects.push(clone);
      draft.selectedObjectId = clone.id;
    }),
  undo: () => {
    const state = get();
    const previous = state.historyPast.at(-1);
    if (!previous) {
      return;
    }

    set({
      ...previous,
      historyPast: state.historyPast.slice(0, -1),
      historyFuture: [buildSnapshot(state), ...state.historyFuture],
    });
  },
  redo: () => {
    const state = get();
    const next = state.historyFuture[0];
    if (!next) {
      return;
    }

    set({
      ...next,
      historyPast: [...state.historyPast, buildSnapshot(state)],
      historyFuture: state.historyFuture.slice(1),
    });
  },
}));

export const selectActiveLayer = (layers: MapcraftLayer[], selectedLayerId: string | null) =>
  layers.find((layer) => layer.id === selectedLayerId) ?? null;

export const selectActiveObject = (
  layers: MapcraftLayer[],
  selectedLayerId: string | null,
  selectedObjectId: string | null,
) => {
  const layer = selectActiveLayer(layers, selectedLayerId);
  if (!layer || !selectedObjectId) {
    return null;
  }

  return layer.objects.find((object) => object.id === selectedObjectId) ?? null;
};
