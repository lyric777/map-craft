import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';

import type {
  MapcraftLayer,
  MapcraftObject,
  MapcraftProject,
  MapcraftViewport,
} from '../types/project';

export const DEFAULT_VIEWPORT: MapcraftViewport = {
  center: [0, 20],
  zoom: 2.5,
};

export const DEFAULT_STYLE = {
  fillColor: '#45c4ff',
  strokeColor: '#ffffff',
  strokeWidth: 2,
  opacity: 0.45,
};

const createId = () => crypto.randomUUID();

export const createDefaultLayer = (name = 'Layer 1'): MapcraftLayer => ({
  id: createId(),
  name,
  visible: true,
  objects: [],
});

export const createEmptyProject = (): MapcraftProject => ({
  version: '0.1',
  viewport: DEFAULT_VIEWPORT,
  layers: [createDefaultLayer()],
});

export const isPolygonGeometry = (geometry: Geometry): geometry is Polygon =>
  geometry.type === 'Polygon';

export const createPolygonObject = (coordinates: Polygon['coordinates'][0]): MapcraftObject => ({
  id: createId(),
  type: 'polygon',
  geometry: {
    type: 'Polygon',
    coordinates: [coordinates],
  },
  style: { ...DEFAULT_STYLE },
  meta: {},
});

export const duplicateObject = (object: MapcraftObject): MapcraftObject => {
  const next = structuredClone(object);
  next.id = createId();
  return next;
};

export const projectToFeatureCollection = (
  layers: MapcraftLayer[],
  selectedObjectId: string | null,
): FeatureCollection<Geometry> => {
  const features: Feature<Geometry>[] = [];

  layers.forEach((layer) => {
    if (!layer.visible) {
      return;
    }

    layer.objects.forEach((object) => {
      features.push({
        type: 'Feature',
        id: object.id,
        geometry: object.geometry,
        properties: {
          objectId: object.id,
          layerId: layer.id,
          objectType: object.type,
          fillColor: object.style.fillColor,
          strokeColor: object.style.strokeColor,
          strokeWidth: object.style.strokeWidth,
          opacity: object.style.opacity,
          isSelected: object.id === selectedObjectId,
        },
      });
    });
  });

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const draftPolygonToFeatureCollection = (
  coordinates: number[][],
): FeatureCollection<Geometry> => {
  if (coordinates.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: Feature<Geometry>[] = [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {},
    },
  ];

  if (coordinates.length >= 3) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[...coordinates, coordinates[0]]],
      },
      properties: {},
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
};
