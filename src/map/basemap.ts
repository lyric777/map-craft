import type maplibregl from 'maplibre-gl';

import type { BasemapPresetId } from '../types/project';

export const BASEMAP_BACKGROUND_LAYER_ID = 'basemap-background';
export const BASEMAP_RASTER_LAYER_ID = 'osm';

export interface BasemapPresetDefinition {
  id: BasemapPresetId;
  label: string;
  backgroundColor: string;
  rasterVisible: boolean;
  rasterSaturation: number;
  rasterContrast: number;
  rasterBrightnessMin: number;
  rasterBrightnessMax: number;
}

export const BASEMAP_PRESETS: BasemapPresetDefinition[] = [
  {
    id: 'standard',
    label: 'Standard',
    backgroundColor: '#d7e6ec',
    rasterVisible: true,
    rasterSaturation: 0,
    rasterContrast: 0,
    rasterBrightnessMin: 0,
    rasterBrightnessMax: 1,
  },
  {
    id: 'light',
    label: 'Light',
    backgroundColor: '#f5f2e9',
    rasterVisible: true,
    rasterSaturation: -0.65,
    rasterContrast: -0.15,
    rasterBrightnessMin: 0.2,
    rasterBrightnessMax: 1,
  },
  {
    id: 'dark',
    label: 'Dark',
    backgroundColor: '#151b22',
    rasterVisible: true,
    rasterSaturation: -0.8,
    rasterContrast: 0.2,
    rasterBrightnessMin: 0,
    rasterBrightnessMax: 0.42,
  },
  {
    id: 'grayscale',
    label: 'Grayscale',
    backgroundColor: '#e5e7eb',
    rasterVisible: true,
    rasterSaturation: -1,
    rasterContrast: 0.08,
    rasterBrightnessMin: 0.08,
    rasterBrightnessMax: 0.92,
  },
  {
    id: 'none',
    label: 'No Basemap',
    backgroundColor: '#f3efe3',
    rasterVisible: false,
    rasterSaturation: 0,
    rasterContrast: 0,
    rasterBrightnessMin: 0,
    rasterBrightnessMax: 1,
  },
];

export const getBasemapPreset = (presetId: BasemapPresetId) =>
  BASEMAP_PRESETS.find((preset) => preset.id === presetId) ?? BASEMAP_PRESETS[0]!;

export const applyBasemapPreset = (map: maplibregl.Map, presetId: BasemapPresetId) => {
  const preset = getBasemapPreset(presetId);

  if (map.getLayer(BASEMAP_BACKGROUND_LAYER_ID)) {
    map.setPaintProperty(BASEMAP_BACKGROUND_LAYER_ID, 'background-color', preset.backgroundColor);
  }

  if (!map.getLayer(BASEMAP_RASTER_LAYER_ID)) {
    return;
  }

  map.setLayoutProperty(
    BASEMAP_RASTER_LAYER_ID,
    'visibility',
    preset.rasterVisible ? 'visible' : 'none',
  );
  map.setPaintProperty(BASEMAP_RASTER_LAYER_ID, 'raster-saturation', preset.rasterSaturation);
  map.setPaintProperty(BASEMAP_RASTER_LAYER_ID, 'raster-contrast', preset.rasterContrast);
  map.setPaintProperty(
    BASEMAP_RASTER_LAYER_ID,
    'raster-brightness-min',
    preset.rasterBrightnessMin,
  );
  map.setPaintProperty(
    BASEMAP_RASTER_LAYER_ID,
    'raster-brightness-max',
    preset.rasterBrightnessMax,
  );
};
