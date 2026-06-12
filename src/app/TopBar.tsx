import { Download, FilePlus2, FolderOpen, Moon, Redo2, Save, Sun, Undo2 } from 'lucide-react';

type ThemeMode = 'dark' | 'light';

interface TopBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExportPng: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

const buttonClassName =
  'inline-flex items-center gap-2 rounded-md border border-border bg-panelAlt px-3 py-2 text-sm text-foreground transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50';

export function TopBar({
  onNew,
  onOpen,
  onSave,
  onExportPng,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  themeMode,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground">MapCraft</h1>
        <p className="text-xs text-subtle">Visual map creation studio</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panelAlt text-foreground transition hover:border-accent"
          onClick={onToggleTheme}
          type="button"
        >
          {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className={buttonClassName} onClick={onNew} type="button">
          <FilePlus2 size={16} />
          New
        </button>
        <button className={buttonClassName} onClick={onOpen} type="button">
          <FolderOpen size={16} />
          Open
        </button>
        <button className={buttonClassName} onClick={onSave} type="button">
          <Save size={16} />
          Save
        </button>
        <button className={buttonClassName} onClick={onExportPng} type="button">
          <Download size={16} />
          Export PNG
        </button>
        <button className={buttonClassName} disabled={!canUndo} onClick={onUndo} type="button">
          <Undo2 size={16} />
          Undo
        </button>
        <button className={buttonClassName} disabled={!canRedo} onClick={onRedo} type="button">
          <Redo2 size={16} />
          Redo
        </button>
      </div>
    </header>
  );
}
