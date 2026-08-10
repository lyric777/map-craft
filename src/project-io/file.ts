import type { BasemapPresetId, MapcraftProject } from '../types/project';

const PROJECT_MIME = 'application/json';

export const serializeProject = (project: MapcraftProject) => JSON.stringify(project, null, 2);

const BASEMAP_PRESETS: BasemapPresetId[] = [
  'road',
  'satellite',
  'terrain',
  'hydrography',
  'none',
];

const LEGACY_APPEARANCE_PRESETS: Record<string, BasemapPresetId> = {
  standard: 'road',
  light: 'road',
  dark: 'road',
  grayscale: 'road',
};

const isBasemapPreset = (value: unknown): value is BasemapPresetId =>
  typeof value === 'string' && BASEMAP_PRESETS.includes(value as BasemapPresetId);

const normalizeBasemapPreset = (value: unknown): BasemapPresetId => {
  if (isBasemapPreset(value)) {
    return value;
  }

  return typeof value === 'string' ? LEGACY_APPEARANCE_PRESETS[value] ?? 'road' : 'road';
};

export const parseProject = (value: string): MapcraftProject => {
  const parsed = JSON.parse(value) as Partial<MapcraftProject>;

  if (
    parsed.version !== '0.1' ||
    !Array.isArray(parsed.layers) ||
    !parsed.viewport ||
    !Array.isArray(parsed.viewport.center) ||
    typeof parsed.viewport.zoom !== 'number'
  ) {
    throw new Error('Invalid .mapcraft project');
  }

  const project = {
    ...parsed,
    basemapPreset: normalizeBasemapPreset(parsed.basemapPreset),
    viewport: {
      ...parsed.viewport,
      pitch: typeof parsed.viewport.pitch === 'number' ? parsed.viewport.pitch : 0,
      bearing: typeof parsed.viewport.bearing === 'number' ? parsed.viewport.bearing : 0,
    },
  } as MapcraftProject;

  project.layers.forEach((layer) => {
    layer.objects.forEach((object) => {
      const height = object.style.extrusionHeight;
      object.style.extrusionHeight =
        typeof height === 'number' && Number.isFinite(height) && height >= 0 ? height : 0;
    });
  });

  return project;
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
