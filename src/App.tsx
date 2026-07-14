import type maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { InspectorPanel } from './app/InspectorPanel';
import { LayerPanel } from './app/LayerPanel';
import { MapCanvas } from './map/MapCanvas';
import { TopBar } from './app/TopBar';
import { ToolBar } from './app/ToolBar';
import type { GeometryEditMode } from './map/types';
import { downloadBlob, downloadProjectFile, readProjectFile } from './project-io/file';
import { useEditorStore, selectActiveLayer, selectActiveObject } from './state/editorStore';
import { TOOL_SHORTCUTS } from './tools/tools';

type ThemeMode = 'dark' | 'light';
const THEME_STORAGE_KEY = 'mapcraft-theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
};

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapToastTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState('Polygon tool ready.');
  const [mapToastMessage, setMapToastMessage] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [geometryEditMode, setGeometryEditMode] = useState<GeometryEditMode | null>(null);
  const state = useEditorStore(
    useShallow((store) => ({
      project: store.project,
      selectedLayerId: store.selectedLayerId,
      selectedObjectId: store.selectedObjectId,
      currentTool: store.currentTool,
      clipboardObject: store.clipboardObject,
      historyPast: store.historyPast,
      historyFuture: store.historyFuture,
      setCurrentTool: store.setCurrentTool,
      setBasemapPreset: store.setBasemapPreset,
      newProject: store.newProject,
      openProject: store.openProject,
      addLayer: store.addLayer,
      renameLayer: store.renameLayer,
      toggleLayerVisibility: store.toggleLayerVisibility,
      toggleLayerLock: store.toggleLayerLock,
      reorderLayer: store.reorderLayer,
      selectLayer: store.selectLayer,
      updateSelectedObjectStyle: store.updateSelectedObjectStyle,
      deleteSelectedObject: store.deleteSelectedObject,
      copySelectedObject: store.copySelectedObject,
      pasteClipboardToSelectedLayer: store.pasteClipboardToSelectedLayer,
      duplicateSelectedObject: store.duplicateSelectedObject,
      undo: store.undo,
      redo: store.redo,
    })),
  );

  const activeLayer = useMemo(
    () => selectActiveLayer(state.project.layers, state.selectedLayerId),
    [state.project.layers, state.selectedLayerId],
  );
  const activeObject = useMemo(
    () => selectActiveObject(state.project.layers, state.selectedLayerId, state.selectedObjectId),
    [state.project.layers, state.selectedLayerId, state.selectedObjectId],
  );

  const handleGeometryEditModeChange = useCallback((mode: GeometryEditMode | null) => {
    setGeometryEditMode(mode);
  }, []);

  const showMapToast = useCallback((message: string) => {
    setMapToastMessage(message);
    if (mapToastTimerRef.current !== null) {
      window.clearTimeout(mapToastTimerRef.current);
    }

    mapToastTimerRef.current = window.setTimeout(() => {
      setMapToastMessage(null);
      mapToastTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    if (
      !activeObject ||
      state.currentTool !== 'move' ||
      activeObject.type === 'point' ||
      activeObject.meta.drawingMode === 'freeDraw'
    ) {
      setGeometryEditMode(null);
    }
  }, [activeObject, state.currentTool]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.body.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => () => {
    if (mapToastTimerRef.current !== null) {
      window.clearTimeout(mapToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (isTyping) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        state.duplicateSelectedObject();
        setStatus('Selection duplicated.');
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        if (!activeObject) {
          setStatus('Select an object to copy.');
          return;
        }

        state.copySelectedObject();
        setStatus('Selection copied.');
        showMapToast('Selection copied.');
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        if (!state.clipboardObject) {
          setStatus('Clipboard is empty.');
          return;
        }

        state.pasteClipboardToSelectedLayer();
        setStatus('Clipboard pasted into the active layer.');
        showMapToast('Clipboard pasted into the active layer.');
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          state.redo();
          setStatus('Redo applied.');
        } else {
          state.undo();
          setStatus('Undo applied.');
        }
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        state.deleteSelectedObject();
        setStatus('Selection deleted.');
        return;
      }

      if (hasModifier) {
        return;
      }

      const shortcutTool = TOOL_SHORTCUTS[event.key.toLowerCase()];
      if (shortcutTool) {
        event.preventDefault();
        state.setCurrentTool(shortcutTool);
        setStatus(`${shortcutTool} tool selected.`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeObject, showMapToast, state]);

  const handleOpenFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const project = await readProjectFile(file);
      state.openProject(project);
      setStatus(`Opened ${file.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to open project.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = () => {
    downloadProjectFile(state.project);
    setStatus('Project exported as .mapcraft.');
  };

  const handleExportPng = async () => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) {
      setStatus('Map is not ready yet.');
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) {
      setStatus('PNG export failed.');
      return;
    }

    downloadBlob(blob, 'mapcraft-export.png');
    setStatus('PNG exported.');
  };

  return (
    <div
      className="mapcraft-shell flex h-screen min-h-screen flex-col bg-surface text-foreground transition-colors"
      data-testid="app-shell"
      data-theme={themeMode}
    >
      <TopBar
        canCopy={Boolean(activeObject)}
        canPaste={Boolean(state.clipboardObject)}
        canRedo={state.historyFuture.length > 0}
        canUndo={state.historyPast.length > 0}
        onCopy={() => {
          if (!activeObject) {
            setStatus('Select an object to copy.');
            return;
          }

          state.copySelectedObject();
          setStatus('Selection copied.');
          showMapToast('Selection copied.');
        }}
        onExportPng={handleExportPng}
        onNew={() => {
          state.newProject();
          setStatus('Started a new project.');
        }}
        onOpen={() => fileInputRef.current?.click()}
        onPaste={() => {
          if (!state.clipboardObject) {
            setStatus('Clipboard is empty.');
            return;
          }

          state.pasteClipboardToSelectedLayer();
          setStatus('Clipboard pasted into the active layer.');
          showMapToast('Clipboard pasted into the active layer.');
        }}
        onRedo={() => {
          state.redo();
          setStatus('Redo applied.');
        }}
        onSave={handleSave}
        onToggleTheme={() => {
          setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
          setStatus(`Switched to ${themeMode === 'dark' ? 'light' : 'dark'} theme.`);
        }}
        onUndo={() => {
          state.undo();
          setStatus('Undo applied.');
        }}
        themeMode={themeMode}
      />

      <input
        ref={fileInputRef}
        accept=".mapcraft,application/json"
        className="hidden"
        onChange={handleOpenFile}
        type="file"
      />

      <div className="grid min-h-0 flex-1 grid-cols-[64px_minmax(0,1fr)_320px]">
        <ToolBar
          currentTool={state.currentTool}
          onSelectTool={(tool) => {
            state.setCurrentTool(tool);
            setStatus(`${tool} tool selected.`);
          }}
        />
        <main className="grid min-h-0 grid-rows-[minmax(0,1fr)_220px] gap-4 p-4">
          <MapCanvas
            basemapPreset={state.project.basemapPreset}
            geometryEditMode={geometryEditMode}
            mapToastMessage={mapToastMessage}
            onBasemapPresetChange={(preset) => {
              state.setBasemapPreset(preset);
              setStatus(`Basemap switched to ${preset}.`);
            }}
            onMapReady={(map) => {
              mapRef.current = map;
            }}
            onGeometryEditModeChange={handleGeometryEditModeChange}
          />
          <div className="grid min-h-0 grid-cols-[360px_minmax(0,1fr)] gap-4">
            <LayerPanel
              layers={state.project.layers}
              onAddLayer={() => {
                state.addLayer();
                setStatus('Layer added.');
              }}
              onRenameLayer={state.renameLayer}
              onReorderLayer={state.reorderLayer}
              onSelectLayer={state.selectLayer}
              onToggleLayer={state.toggleLayerVisibility}
              onToggleLayerLock={(layerId) => {
                state.toggleLayerLock(layerId);
                const layer = state.project.layers.find((candidate) => candidate.id === layerId);
                setStatus(layer?.locked ? 'Layer unlocked.' : 'Layer locked.');
              }}
              selectedLayerId={state.selectedLayerId}
              selectedObjectId={state.selectedObjectId}
            />
            <section className="rounded-md border border-border bg-panel px-4 py-3">
              <div className="text-sm font-medium text-foreground">Session</div>
              <div className="mt-2 text-sm text-muted">{status}</div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-subtle">
                <div>
                  <div className="text-xs uppercase tracking-wide">Active Layer</div>
                  <div className="mt-1 text-foreground">{activeLayer?.name ?? 'None'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide">Objects</div>
                  <div className="mt-1 text-foreground">
                    {state.project.layers.reduce((sum, layer) => sum + layer.objects.length, 0)}
                  </div>
                </div>
              </div>
              <div className="mt-6 text-xs text-subtle">
                Shortcuts: `V` Move, `F` Free Draw, `E` Eraser, `P` Point, `L` Line, `B` Polygon,
                `Delete` Remove, `Ctrl/Cmd+C` Copy, `Ctrl/Cmd+V` Paste, `Ctrl/Cmd+D` Duplicate,
                `Ctrl/Cmd+Z` Undo, `Ctrl/Cmd+Shift+Z` Redo.
              </div>
            </section>
          </div>
        </main>
        <div className="border-l border-border p-4">
          <InspectorPanel
            geometryEditMode={geometryEditMode}
            object={activeObject}
            onDelete={() => {
              state.deleteSelectedObject();
              setStatus('Selection deleted.');
            }}
            onDuplicate={() => {
              state.duplicateSelectedObject();
              setStatus('Selection duplicated.');
            }}
            onGeometryEditModeChange={(mode) => {
              handleGeometryEditModeChange(mode);
              if (mode === 'insertVertex') {
                setStatus('Click an edge to add a vertex.');
                return;
              }

              if (mode === 'deleteVertex') {
                setStatus('Click a vertex to remove it.');
                return;
              }

              setStatus('Geometry edit mode cleared.');
            }}
            onStyleChange={(style) => {
              state.updateSelectedObjectStyle(style);
              setStatus('Style updated.');
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
