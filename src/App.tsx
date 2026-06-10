import type maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { InspectorPanel } from './app/InspectorPanel';
import { LayerPanel } from './app/LayerPanel';
import { MapCanvas } from './map/MapCanvas';
import { TopBar } from './app/TopBar';
import { ToolBar } from './app/ToolBar';
import { downloadBlob, downloadProjectFile, readProjectFile } from './project-io/file';
import { useEditorStore, selectActiveLayer, selectActiveObject } from './state/editorStore';
import { TOOL_SHORTCUTS } from './tools/tools';

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState('Polygon tool ready.');
  const state = useEditorStore(
    useShallow((store) => ({
      project: store.project,
      selectedLayerId: store.selectedLayerId,
      selectedObjectId: store.selectedObjectId,
      currentTool: store.currentTool,
      historyPast: store.historyPast,
      historyFuture: store.historyFuture,
      setCurrentTool: store.setCurrentTool,
      newProject: store.newProject,
      openProject: store.openProject,
      addLayer: store.addLayer,
      renameLayer: store.renameLayer,
      toggleLayerVisibility: store.toggleLayerVisibility,
      reorderLayer: store.reorderLayer,
      selectLayer: store.selectLayer,
      updateSelectedObjectStyle: store.updateSelectedObjectStyle,
      deleteSelectedObject: store.deleteSelectedObject,
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (isTyping) {
        return;
      }

      const shortcutTool = TOOL_SHORTCUTS[event.key.toLowerCase()];
      if (shortcutTool) {
        event.preventDefault();
        state.setCurrentTool(shortcutTool);
        setStatus(`${shortcutTool} tool selected.`);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        state.duplicateSelectedObject();
        setStatus('Selection duplicated.');
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

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
    <div className="flex h-screen min-h-screen flex-col bg-surface text-slate-100">
      <TopBar
        canRedo={state.historyFuture.length > 0}
        canUndo={state.historyPast.length > 0}
        onExportPng={handleExportPng}
        onNew={() => {
          state.newProject();
          setStatus('Started a new project.');
        }}
        onOpen={() => fileInputRef.current?.click()}
        onRedo={() => {
          state.redo();
          setStatus('Redo applied.');
        }}
        onSave={handleSave}
        onUndo={() => {
          state.undo();
          setStatus('Undo applied.');
        }}
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
            onMapReady={(map) => {
              mapRef.current = map;
            }}
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
              selectedLayerId={state.selectedLayerId}
              selectedObjectId={state.selectedObjectId}
            />
            <section className="rounded-md border border-border bg-panel px-4 py-3 shadow-panel">
              <div className="text-sm font-medium text-white">Session</div>
              <div className="mt-2 text-sm text-slate-300">{status}</div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-slate-400">
                <div>
                  <div className="text-xs uppercase tracking-wide">Active Layer</div>
                  <div className="mt-1 text-white">{activeLayer?.name ?? 'None'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide">Objects</div>
                  <div className="mt-1 text-white">
                    {state.project.layers.reduce((sum, layer) => sum + layer.objects.length, 0)}
                  </div>
                </div>
              </div>
              <div className="mt-6 text-xs text-slate-400">
                Shortcuts: `B` Polygon, `V` Move, `Delete` Remove, `Ctrl/Cmd+D` Duplicate, `Ctrl/Cmd+Z`
                Undo, `Ctrl/Cmd+Shift+Z` Redo.
              </div>
            </section>
          </div>
        </main>
        <div className="border-l border-border p-4">
          <InspectorPanel
            object={activeObject}
            onDelete={() => {
              state.deleteSelectedObject();
              setStatus('Selection deleted.');
            }}
            onDuplicate={() => {
              state.duplicateSelectedObject();
              setStatus('Selection duplicated.');
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
