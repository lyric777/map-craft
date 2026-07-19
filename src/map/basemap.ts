import type maplibregl from 'maplibre-gl';

import type { BasemapPresetId } from '../types/project';

export const BASEMAP_BACKGROUND_LAYER_ID = 'basemap-background';
export const BASEMAP_ROAD_LAYER_ID = 'basemap-road';
export const BASEMAP_SATELLITE_LAYER_ID = 'basemap-satellite';
export const BASEMAP_TERRAIN_LAYER_ID = 'basemap-terrain';
export const BASEMAP_HYDROGRAPHY_LAYER_IDS = [
  'basemap-hydrography-water',
  'basemap-hydrography-waterway',
] as const;

const ALL_CONTENT_LAYER_IDS = [
  BASEMAP_ROAD_LAYER_ID,
  BASEMAP_SATELLITE_LAYER_ID,
  BASEMAP_TERRAIN_LAYER_ID,
  ...BASEMAP_HYDROGRAPHY_LAYER_IDS,
] as const;

export interface BasemapPresetDefinition {
  id: BasemapPresetId;
  label: string;
  description: string;
  backgroundColor: string;
  visibleLayerIds: readonly string[];
}

export const BASEMAP_PRESETS: BasemapPresetDefinition[] = [
  {
    id: 'road',
    label: 'Road',
    description: 'Roads, cities, and places',
    backgroundColor: '#d7e6ec',
    visibleLayerIds: [BASEMAP_ROAD_LAYER_ID],
  },
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'NASA global satellite imagery',
    backgroundColor: '#0b1820',
    visibleLayerIds: [BASEMAP_SATELLITE_LAYER_ID],
  },
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Topography and elevation',
    backgroundColor: '#e8e2cf',
    visibleLayerIds: [BASEMAP_TERRAIN_LAYER_ID],
  },
  {
    id: 'hydrography',
    label: 'Hydrography',
    description: 'Rivers, lakes, and coastlines',
    backgroundColor: '#f1eee5',
    visibleLayerIds: BASEMAP_HYDROGRAPHY_LAYER_IDS,
  },
  {
    id: 'none',
    label: 'Blank',
    description: 'Plain drawing canvas',
    backgroundColor: '#f3efe3',
    visibleLayerIds: [],
  },
];

export const getBasemapPreset = (presetId: BasemapPresetId) =>
  BASEMAP_PRESETS.find((preset) => preset.id === presetId) ?? BASEMAP_PRESETS[0]!;

export const applyBasemapPreset = (map: maplibregl.Map, presetId: BasemapPresetId) => {
  const preset = getBasemapPreset(presetId);
  const visibleLayers = new Set(preset.visibleLayerIds);

  if (map.getLayer(BASEMAP_BACKGROUND_LAYER_ID)) {
    map.setPaintProperty(BASEMAP_BACKGROUND_LAYER_ID, 'background-color', preset.backgroundColor);
  }

  ALL_CONTENT_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibleLayers.has(layerId) ? 'visible' : 'none');
    }
  });
};
