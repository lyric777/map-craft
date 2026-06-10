import { Hand, MapPin, PenTool, Route, Shapes } from 'lucide-react';

import { TOOL_LABELS } from '../tools/tools';
import type { ToolId } from '../types/project';

interface ToolBarProps {
  currentTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
}

const tools: { id: ToolId; icon: typeof Hand; disabled?: boolean }[] = [
  { id: 'move', icon: Hand },
  { id: 'freeDraw', icon: PenTool, disabled: true },
  { id: 'point', icon: MapPin, disabled: true },
  { id: 'line', icon: Route, disabled: true },
  { id: 'polygon', icon: Shapes },
];

export function ToolBar({ currentTool, onSelectTool }: ToolBarProps) {
  return (
    <aside className="flex w-16 flex-col items-center gap-3 border-r border-border bg-panel px-2 py-4">
      {tools.map(({ id, icon: Icon, disabled }) => {
        const active = currentTool === id;
        return (
          <button
            key={id}
            className={`group relative inline-flex h-11 w-11 items-center justify-center rounded-md border transition ${
              active
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-panelAlt text-slate-300 hover:border-accent hover:text-white'
            } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
            disabled={disabled}
            onClick={() => onSelectTool(id)}
            title={disabled ? `${TOOL_LABELS[id]} (coming next)` : TOOL_LABELS[id]}
            type="button"
          >
            <Icon size={18} />
          </button>
        );
      })}
    </aside>
  );
}
