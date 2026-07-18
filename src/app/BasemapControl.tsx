import { Check, Map as MapIcon } from 'lucide-react';
import { useState } from 'react';

import { BASEMAP_PRESETS } from '../map/basemap';
import type { BasemapPresetId } from '../types/project';

interface BasemapControlProps {
  preset: BasemapPresetId;
  onChange: (preset: BasemapPresetId) => void;
}

export function BasemapControl({ preset, onChange }: BasemapControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-3 top-[88px] z-10">
      <button
        aria-expanded={open}
        aria-label="Choose basemap style"
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white text-slate-700 shadow-md transition hover:bg-slate-100"
        onClick={() => setOpen((current) => !current)}
        title="Basemap style"
        type="button"
      >
        <MapIcon size={16} />
      </button>

      {open ? (
        <div
          aria-label="Basemap styles"
          className="mt-2 w-52 rounded-md border border-border bg-panel p-2 shadow-panel"
          role="menu"
        >
          <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-subtle">
            Basemap
          </div>
          <div className="space-y-1">
            {BASEMAP_PRESETS.map((option) => {
              const selected = option.id === preset;
              return (
                <button
                  aria-checked={selected}
                  className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm transition ${
                    selected
                      ? 'bg-accent/15 text-foreground'
                      : 'text-muted hover:bg-panelAlt hover:text-foreground'
                  }`}
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  role="menuitemradio"
                  type="button"
                >
                  <span>
                    <span className="block">{option.label}</span>
                    <span className="block text-xs text-subtle">{option.description}</span>
                  </span>
                  {selected ? <Check aria-hidden="true" size={15} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
