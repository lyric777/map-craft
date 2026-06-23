import type { FeatureCollection, Geometry } from 'geojson';
import type { StyleSpecification } from 'maplibre-gl';

export const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
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
