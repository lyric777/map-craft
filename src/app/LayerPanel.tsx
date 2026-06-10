import { ArrowDown, ArrowUp, Eye, EyeOff, Layers2, Plus } from 'lucide-react';

import type { MapcraftLayer } from '../types/project';

interface LayerPanelProps {
  layers: MapcraftLayer[];
  selectedLayerId: string | null;
  selectedObjectId: string | null;
  onAddLayer: () => void;
  onSelectLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleLayer: (layerId: string) => void;
  onReorderLayer: (layerId: string, direction: 'up' | 'down') => void;
}

export function LayerPanel({
  layers,
  selectedLayerId,
  selectedObjectId,
  onAddLayer,
  onSelectLayer,
  onRenameLayer,
  onToggleLayer,
  onReorderLayer,
}: LayerPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-md border border-border bg-panel px-3 py-3 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Layers2 size={16} />
          Layers
        </div>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-panelAlt text-slate-300 hover:border-accent hover:text-white"
          onClick={onAddLayer}
          title="Add layer"
          type="button"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-2 overflow-y-auto pr-1">
        {layers.map((layer, index) => {
          const active = layer.id === selectedLayerId;
          return (
            <div
              key={layer.id}
              className={`rounded-md border px-3 py-2 ${
                active ? 'border-accent bg-accent/10' : 'border-border bg-panelAlt'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  className="flex-1 text-left text-sm text-white"
                  onClick={() => onSelectLayer(layer.id)}
                  type="button"
                >
                  <input
                    className="w-full bg-transparent text-sm text-white outline-none"
                    onBlur={(event) => onRenameLayer(layer.id, event.target.value.trim())}
                    defaultValue={layer.name}
                  />
                </button>
                <button
                  className="text-slate-300 hover:text-white"
                  onClick={() => onToggleLayer(layer.id)}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  type="button"
                >
                  {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  className="text-slate-300 hover:text-white disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => onReorderLayer(layer.id, 'up')}
                  title="Move layer up"
                  type="button"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="text-slate-300 hover:text-white disabled:opacity-30"
                  disabled={index === layers.length - 1}
                  onClick={() => onReorderLayer(layer.id, 'down')}
                  title="Move layer down"
                  type="button"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {layer.objects.length} objects
                {active && selectedObjectId ? ' · selection active' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
