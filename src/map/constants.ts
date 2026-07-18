import type { FeatureCollection, Geometry } from 'geojson';
import type { StyleSpecification } from 'maplibre-gl';
import {
  BASEMAP_BACKGROUND_LAYER_ID,
  BASEMAP_HYDROGRAPHY_LAYER_IDS,
  BASEMAP_ROAD_LAYER_ID,
  BASEMAP_TERRAIN_LAYER_ID,
} from './basemap';

export const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    road: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
    terrain: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    },
    hydrography: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap',
    },
  },
  layers: [
    {
      id: BASEMAP_BACKGROUND_LAYER_ID,
      type: 'background',
      paint: {
        'background-color': '#d7e6ec',
      },
    },
    {
      id: BASEMAP_ROAD_LAYER_ID,
      type: 'raster',
      source: 'road',
    },
    {
      id: BASEMAP_TERRAIN_LAYER_ID,
      type: 'raster',
      source: 'terrain',
      layout: {
        visibility: 'none',
      },
    },
    {
      id: BASEMAP_HYDROGRAPHY_LAYER_IDS[0],
      type: 'fill',
      source: 'hydrography',
      'source-layer': 'water',
      layout: {
        visibility: 'none',
      },
      paint: {
        'fill-color': '#80c7e8',
        'fill-outline-color': '#4aa6cf',
      },
    },
    {
      id: BASEMAP_HYDROGRAPHY_LAYER_IDS[1],
      type: 'line',
      source: 'hydrography',
      'source-layer': 'waterway',
      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#3295c3',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          0.5,
          12,
          2,
          16,
          5,
        ],
      },
    },
  ],
};

export const OBJECTS_SOURCE_ID = 'objects';
export const DRAFT_SOURCE_ID = 'draft';
export const EDIT_SOURCE_ID = 'edit-vertices';

export const OBJECT_INTERACTIVE_LAYER_IDS = [
  'polygon-fill-hit',
  'polygon-line-hit',
  'line-string-hit',
  'points-hit',
  'polygon-fill',
  'polygon-line',
  'line-string',
  'points',
] as const;

export const FREE_DRAW_POINT_THRESHOLD = 4;
export const ERASER_POINT_THRESHOLD = 4;
export const ERASER_RADIUS_PX = 8;

export const EMPTY_GEOJSON: FeatureCollection<Geometry> = {
  type: 'FeatureCollection',
  features: [],
};
