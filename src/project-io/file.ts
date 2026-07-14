import type { BasemapPresetId, MapcraftProject } from '../types/project';

const PROJECT_MIME = 'application/json';

export const serializeProject = (project: MapcraftProject) => JSON.stringify(project, null, 2);

const BASEMAP_PRESETS: BasemapPresetId[] = ['standard', 'light', 'dark', 'grayscale', 'none'];

const isBasemapPreset = (value: unknown): value is BasemapPresetId =>
  typeof value === 'string' && BASEMAP_PRESETS.includes(value as BasemapPresetId);

export const parseProject = (value: string): MapcraftProject => {
  const parsed = JSON.parse(value) as Partial<MapcraftProject>;

  if (parsed.version !== '0.1' || !Array.isArray(parsed.layers)) {
    throw new Error('Invalid .mapcraft project');
  }

  return {
    ...parsed,
    basemapPreset: isBasemapPreset(parsed.basemapPreset) ? parsed.basemapPreset : 'standard',
  } as MapcraftProject;
};

export const downloadProjectFile = (project: MapcraftProject) => {
  const blob = new Blob([serializeProject(project)], { type: PROJECT_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'project.mapcraft';
  anchor.click();
  URL.revokeObjectURL(url);
};

export const readProjectFile = async (file: File) => parseProject(await file.text());

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
