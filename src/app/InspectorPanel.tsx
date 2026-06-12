import { Copy, Trash2 } from 'lucide-react';

import type { MapcraftObject } from '../types/project';

interface InspectorPanelProps {
  object: MapcraftObject | null;
  onStyleChange: (style: Partial<MapcraftObject['style']>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const labelClassName = 'mb-1 block text-xs font-medium uppercase tracking-wide text-subtle';

export function InspectorPanel({
  object,
  onStyleChange,
  onDelete,
  onDuplicate,
}: InspectorPanelProps) {
  return (
    <aside className="flex h-full flex-col rounded-md border border-border bg-panel px-4 py-4 shadow-panel">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Inspector</h2>
        <p className="mt-1 text-xs text-subtle">
          {object ? 'Selected object style updates instantly on the map.' : 'Select a shape to edit.'}
        </p>
      </div>

      {!object ? (
        <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-subtle">
          No object selected.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-panelAlt px-3 py-3 text-xs text-muted">
            <div className="font-medium text-foreground">{object.type}</div>
            <div className="mt-1 break-all text-subtle">{object.id}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClassName}>Fill</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-panelAlt p-1"
                type="color"
                value={object.style.fillColor}
                onChange={(event) => onStyleChange({ fillColor: event.target.value })}
              />
            </label>
            <label>
              <span className={labelClassName}>Stroke</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-panelAlt p-1"
                type="color"
                value={object.style.strokeColor}
                onChange={(event) => onStyleChange({ strokeColor: event.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClassName}>Stroke Width</span>
            <input
              className="w-full accent-accent"
              max={12}
              min={1}
              step={1}
              type="range"
              value={object.style.strokeWidth}
              onChange={(event) => onStyleChange({ strokeWidth: Number(event.target.value) })}
            />
            <div className="mt-1 text-xs text-subtle">{object.style.strokeWidth}px</div>
          </label>

          <label className="block">
            <span className={labelClassName}>Opacity</span>
            <input
              className="w-full accent-accent"
              max={1}
              min={0.05}
              step={0.05}
              type="range"
              value={object.style.opacity}
              onChange={(event) => onStyleChange({ opacity: Number(event.target.value) })}
            />
            <div className="mt-1 text-xs text-subtle">{Math.round(object.style.opacity * 100)}%</div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-panelAlt px-3 py-2 text-sm text-foreground hover:border-accent"
              onClick={onDuplicate}
              type="button"
            >
              <Copy size={16} />
              Duplicate
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-dangerBorder bg-dangerSoft px-3 py-2 text-sm text-danger hover:border-danger"
              onClick={onDelete}
              type="button"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
