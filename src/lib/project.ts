import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Polygon,
  Position,
} from 'geojson';

import type {
  MapcraftLayer,
  MapcraftObject,
  MapcraftProject,
  MapcraftViewport,
  MapObjectType,
} from '../types/project';

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Geometry> = {
  type: 'FeatureCollection',
  features: [],
};

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

const cloneCoordinate = (coordinate: Position): Position => [coordinate[0], coordinate[1]];

const cloneCoordinates = (coordinates: Position[]) => coordinates.map(cloneCoordinate);

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

export const isLineGeometry = (geometry: Geometry): geometry is LineString =>
  geometry.type === 'LineString';

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

export const createPointObject = (coordinate: Position): MapcraftObject => ({
  id: createId(),
  type: 'point',
  geometry: {
    type: 'Point',
    coordinates: coordinate,
  },
  style: { ...DEFAULT_STYLE },
  meta: {},
});

export const createLineObject = (coordinates: Position[]): MapcraftObject => ({
  id: createId(),
  type: 'line',
  geometry: {
    type: 'LineString',
    coordinates,
  },
  style: { ...DEFAULT_STYLE },
  meta: {},
});

export const createFreeDrawObject = (coordinates: Position[]): MapcraftObject => ({
  id: createId(),
  type: 'line',
  geometry: {
    type: 'LineString',
    coordinates,
  },
  style: { ...DEFAULT_STYLE },
  meta: {
    drawingMode: 'freeDraw',
  },
});

const SMOOTHING_WINDOW_RADIUS = 2;
const FREE_DRAW_SIMPLIFY_EPSILON = 0.00008;

const getSmoothedCoordinate = (coordinates: Position[], index: number): Position => {
  if (index === 0 || index === coordinates.length - 1) {
    return cloneCoordinate(coordinates[index]!);
  }

  let lng = 0;
  let lat = 0;
  let count = 0;

  for (
    let sampleIndex = Math.max(0, index - SMOOTHING_WINDOW_RADIUS);
    sampleIndex <= Math.min(coordinates.length - 1, index + SMOOTHING_WINDOW_RADIUS);
    sampleIndex += 1
  ) {
    lng += coordinates[sampleIndex]![0];
    lat += coordinates[sampleIndex]![1];
    count += 1;
  }

  return [lng / count, lat / count];
};

const getPerpendicularDistance = (point: Position, start: Position, end: Position) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / Math.hypot(dx, dy);
};

const simplifySegment = (coordinates: Position[], epsilon: number): Position[] => {
  if (coordinates.length <= 2) {
    return cloneCoordinates(coordinates);
  }

  const first = coordinates[0]!;
  const last = coordinates[coordinates.length - 1]!;
  let maxDistance = 0;
  let splitIndex = 0;

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const distance = getPerpendicularDistance(coordinates[index]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= epsilon) {
    return [cloneCoordinate(first), cloneCoordinate(last)];
  }

  const left = simplifySegment(coordinates.slice(0, splitIndex + 1), epsilon);
  const right = simplifySegment(coordinates.slice(splitIndex), epsilon);
  return [...left.slice(0, -1), ...right];
};

export const smoothFreeDrawCoordinates = (coordinates: Position[]) => {
  if (coordinates.length <= 2) {
    return cloneCoordinates(coordinates);
  }

  return coordinates.map((_, index) => getSmoothedCoordinate(coordinates, index));
};

export const simplifyFreeDrawCoordinates = (coordinates: Position[], epsilon = FREE_DRAW_SIMPLIFY_EPSILON) => {
  if (coordinates.length <= 2) {
    return cloneCoordinates(coordinates);
  }

  return simplifySegment(coordinates, epsilon);
};

export const processFreeDrawCoordinates = (coordinates: Position[]) => {
  const smoothed = smoothFreeDrawCoordinates(coordinates);
  const simplified = simplifyFreeDrawCoordinates(smoothed);
  return simplified.length >= 2 ? simplified : smoothed.slice(0, 2);
};

export const isFreeDrawObject = (object: MapcraftObject | null) => {
  if (!object) {
    return false;
  }

  return object.meta.drawingMode === 'freeDraw';
};

export const duplicateObject = (object: MapcraftObject): MapcraftObject => {
  const next = structuredClone(object);
  next.id = createId();
  return next;
};

export const getEditableVertices = (object: MapcraftObject | null): Position[] | null => {
  if (!object) {
    return null;
  }

  if (isFreeDrawObject(object)) {
    return [];
  }

  if (object.type === 'line' && isLineGeometry(object.geometry)) {
    return cloneCoordinates(object.geometry.coordinates);
  }

  if (object.type === 'polygon' && isPolygonGeometry(object.geometry)) {
    const ring = object.geometry.coordinates[0] ?? [];
    if (ring.length === 0) {
      return [];
    }

    return cloneCoordinates(ring.slice(0, -1));
  }

  return null;
};

export const buildGeometryFromVertices = (
  objectType: MapObjectType,
  vertices: Position[],
): Geometry | null => {
  if (objectType === 'line') {
    if (vertices.length < 2) {
      return null;
    }

    return {
      type: 'LineString',
      coordinates: cloneCoordinates(vertices),
    };
  }

  if (objectType === 'polygon') {
    if (vertices.length < 3) {
      return null;
    }

    const closedRing = [...cloneCoordinates(vertices), cloneCoordinate(vertices[0])];
    return {
      type: 'Polygon',
      coordinates: [closedRing],
    };
  }

  return null;
};

export const translateGeometry = (
  geometry: Geometry,
  deltaLng: number,
  deltaLat: number,
): Geometry | null => {
  if (geometry.type === 'Point') {
    return {
      type: 'Point',
      coordinates: [geometry.coordinates[0] + deltaLng, geometry.coordinates[1] + deltaLat],
    };
  }

  if (geometry.type === 'LineString') {
    return {
      type: 'LineString',
      coordinates: geometry.coordinates.map((coordinate) => [
        coordinate[0] + deltaLng,
        coordinate[1] + deltaLat,
      ]),
    };
  }

  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring) =>
        ring.map((coordinate) => [coordinate[0] + deltaLng, coordinate[1] + deltaLat]),
      ),
    };
  }

  return null;
};

export const projectToFeatureCollection = (
  layers: MapcraftLayer[],
  selectedObjectId: string | null,
  hoveredObjectId: string | null,
  geometryOverrides: Record<string, Geometry> = {},
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
        geometry: geometryOverrides[object.id] ?? object.geometry,
        properties: {
          objectId: object.id,
          layerId: layer.id,
          objectType: object.type,
          isFreeDraw: object.meta.drawingMode === 'freeDraw',
          fillColor: object.style.fillColor,
          strokeColor: object.style.strokeColor,
          strokeWidth: object.style.strokeWidth,
          opacity: object.style.opacity,
          isSelected: object.id === selectedObjectId,
          isHovered: object.id === hoveredObjectId,
        },
      });
    });
  });

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const vertexHandlesToFeatureCollection = (
  vertices: Position[],
  hoveredIndex: number | null,
  draggingIndex: number | null,
): FeatureCollection<Geometry> => {
  if (vertices.length === 0) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return {
    type: 'FeatureCollection',
    features: vertices.map((coordinate, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cloneCoordinate(coordinate),
      },
      properties: {
        vertexIndex: index,
        isHover: hoveredIndex === index,
        isDragging: draggingIndex === index,
      },
    })),
  };
};

export const draftPolygonToFeatureCollection = (
  committedCoordinates: number[][],
  previewCoordinate: number[] | null,
  snapToStart: boolean,
): FeatureCollection<Geometry> => {
  if (committedCoordinates.length === 0) {
    return EMPTY_FEATURE_COLLECTION;
  }

  const features: Feature<Geometry>[] = [];

  if (committedCoordinates.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: committedCoordinates,
      },
      properties: {
        draftRole: 'committed-line',
      },
    });
  }

  committedCoordinates.forEach((coordinate, index) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinate,
      },
      properties: {
        draftRole: index === 0 ? 'start-vertex' : 'vertex',
        snapReady: snapToStart && index === 0,
      },
    });
  });

  const livePreviewCoordinate =
    previewCoordinate && snapToStart ? committedCoordinates[0] : previewCoordinate;

  if (livePreviewCoordinate && committedCoordinates.length >= 1) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [committedCoordinates.at(-1)!, livePreviewCoordinate],
      },
      properties: {
        draftRole: 'active-line',
      },
    });
  }

  const polygonPreviewCoordinates = livePreviewCoordinate
    ? [...committedCoordinates, livePreviewCoordinate]
    : committedCoordinates;

  if (polygonPreviewCoordinates.length >= 3) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[...polygonPreviewCoordinates, committedCoordinates[0]]],
      },
      properties: {
        draftRole: 'preview-fill',
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const draftLineToFeatureCollection = (
  committedCoordinates: number[][],
  previewCoordinate: number[] | null,
): FeatureCollection<Geometry> => {
  if (committedCoordinates.length === 0) {
    return EMPTY_FEATURE_COLLECTION;
  }

  const features: Feature<Geometry>[] = [];

  if (committedCoordinates.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: committedCoordinates,
      },
      properties: {
        draftRole: 'committed-line',
      },
    });
  }

  committedCoordinates.forEach((coordinate, index) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinate,
      },
      properties: {
        draftRole: index === 0 ? 'start-vertex' : 'vertex',
      },
    });
  });

  if (previewCoordinate) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [committedCoordinates.at(-1)!, previewCoordinate],
      },
      properties: {
        draftRole: 'active-line',
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const freeDrawToFeatureCollection = (
  coordinates: Position[],
): FeatureCollection<Geometry> => {
  if (coordinates.length < 2) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          draftRole: 'free-draw-line',
        },
      },
    ],
  };
};
