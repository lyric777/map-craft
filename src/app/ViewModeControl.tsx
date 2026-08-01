export type ViewMode = '2d' | '3d';

interface ViewModeControlProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeControl({ mode, onChange }: ViewModeControlProps) {
  return (
    <div
      aria-label="Map view"
      className="absolute right-3 top-[128px] z-10 flex overflow-hidden rounded-md border border-white/20 bg-white text-xs font-semibold text-slate-700 shadow-md"
      role="group"
    >
      {(['2d', '3d'] as const).map((option) => (
        <button
          aria-pressed={mode === option}
          className={`h-8 px-2 transition ${
            mode === option ? 'bg-slate-700 text-white' : 'hover:bg-slate-100'
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
