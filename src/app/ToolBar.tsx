import { Hand, MapPin, PenTool, Route, Shapes } from 'lucide-react';
import { useState } from 'react';

import { TOOL_LABELS } from '../tools/tools';
import type { ToolId } from '../types/project';

interface ToolBarProps {
  currentTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
}

const tools: { id: ToolId; icon: typeof Hand; disabled?: boolean }[] = [
  { id: 'move', icon: Hand },
  { id: 'freeDraw', icon: PenTool, disabled: true },
  { id: 'point', icon: MapPin },
  { id: 'line', icon: Route },
  { id: 'polygon', icon: Shapes },
];

export function ToolBar({ currentTool, onSelectTool }: ToolBarProps) {
  const [hoveredTool, setHoveredTool] = useState<ToolId | null>(null);

  return (
    <aside className="flex w-16 flex-col items-center gap-3 border-r border-border bg-panel px-2 py-4">
      {tools.map(({ id, icon: Icon, disabled }) => {
        const active = currentTool === id;
        const tooltipText = disabled ? `${TOOL_LABELS[id]} · Coming next` : TOOL_LABELS[id];
        return (
          <div
            key={id}
            className="relative flex cursor-default items-center justify-center"
            onMouseEnter={() => setHoveredTool(id)}
            onMouseLeave={() => setHoveredTool((current) => (current === id ? null : current))}
          >
            <button
              className={`group relative inline-flex h-11 w-11 items-center justify-center rounded-md border transition ${
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-panelAlt text-slate-300 hover:border-accent hover:text-white'
              } ${disabled ? 'opacity-45' : ''} cursor-default`}
              disabled={disabled}
              onClick={() => onSelectTool(id)}
              onBlur={() => setHoveredTool((current) => (current === id ? null : current))}
              onFocus={() => setHoveredTool(id)}
              type="button"
            >
              <Icon size={18} />
            </button>
            {hoveredTool === id && (
              <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs text-slate-100 shadow-panel">
                {tooltipText}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
