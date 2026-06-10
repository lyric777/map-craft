import { Download, FilePlus2, FolderOpen, Redo2, Save, Undo2 } from 'lucide-react';

interface TopBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExportPng: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const buttonClassName =
  'inline-flex items-center gap-2 rounded-md border border-border bg-panelAlt px-3 py-2 text-sm text-slate-100 transition hover:border-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

export function TopBar({
  onNew,
  onOpen,
  onSave,
  onExportPng,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-3">
      <div>
        <h1 className="text-lg font-semibold text-white">MapCraft</h1>
        <p className="text-xs text-slate-400">Visual map creation studio</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
