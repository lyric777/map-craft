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

interface ScreenPointLike {
  x: number;
  y: number;
}

export interface SegmentHit {
  segmentIndex: number;
  distance: number;
}

export type GeometryEditResult =
  | {
      kind: 'update';
      geometry: Geometry;
    }
  | {
      kind: 'delete';
    };

const ERASER_TRIM_SAMPLES = 24;
const ERASER_TRIM_BINARY_STEPS = 12;
const ERASER_TRIM_EPSILON = 0.000001;

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
  locked: false,
  objects: [],
});

export const createEmptyProject = (): MapcraftProject => ({
  version: '0.1',
  basemapPreset: 'standard',
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
const PASTE_OFFSET_PX = 24;

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

export const getSourceObjectId = (object: MapcraftObject) =>
  typeof object.meta.sourceObjectId === 'string' ? object.meta.sourceObjectId : object.id;

const getScreenPointToSegmentDistance = (
  point: ScreenPointLike,
  start: ScreenPointLike,
  end: ScreenPointLike,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, projection));
  const nearestX = start.x + dx * t;
  const nearestY = start.y + dy * t;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
};

const getDistanceToEraserPath = (point: ScreenPointLike, eraserPath: ScreenPointLike[]) => {
  if (eraserPath.length <= 1) {
    const anchor = eraserPath[0]!;
    return Math.hypot(point.x - anchor.x, point.y - anchor.y);
  }

  return getScreenPointToSegmentDistance(point, eraserPath[0]!, eraserPath[eraserPath.length - 1]!);
};

const getOrientation = (a: ScreenPointLike, b: ScreenPointLike, c: ScreenPointLike) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.000001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
};

const isPointOnSegment = (a: ScreenPointLike, b: ScreenPointLike, point: ScreenPointLike) =>
  point.x <= Math.max(a.x, b.x) &&
  point.x >= Math.min(a.x, b.x) &&
  point.y <= Math.max(a.y, b.y) &&
  point.y >= Math.min(a.y, b.y);

const segmentsIntersect = (
  segmentAStart: ScreenPointLike,
  segmentAEnd: ScreenPointLike,
  segmentBStart: ScreenPointLike,
  segmentBEnd: ScreenPointLike,
) => {
  const orientation1 = getOrientation(segmentAStart, segmentAEnd, segmentBStart);
  const orientation2 = getOrientation(segmentAStart, segmentAEnd, segmentBEnd);
  const orientation3 = getOrientation(segmentBStart, segmentBEnd, segmentAStart);
  const orientation4 = getOrientation(segmentBStart, segmentBEnd, segmentAEnd);

  if (orientation1 !== orientation2 && orientation3 !== orientation4) {
    return true;
  }

  if (orientation1 === 0 && isPointOnSegment(segmentAStart, segmentAEnd, segmentBStart)) {
    return true;
  }

  if (orientation2 === 0 && isPointOnSegment(segmentAStart, segmentAEnd, segmentBEnd)) {
    return true;
  }

  if (orientation3 === 0 && isPointOnSegment(segmentBStart, segmentBEnd, segmentAStart)) {
    return true;
  }

  if (orientation4 === 0 && isPointOnSegment(segmentBStart, segmentBEnd, segmentAEnd)) {
    return true;
  }

  return false;
};

const getSegmentToSegmentDistance = (
  segmentAStart: ScreenPointLike,
  segmentAEnd: ScreenPointLike,
  segmentBStart: ScreenPointLike,
  segmentBEnd: ScreenPointLike,
) => {
  if (segmentsIntersect(segmentAStart, segmentAEnd, segmentBStart, segmentBEnd)) {
    return 0;
  }

  return Math.min(
    getScreenPointToSegmentDistance(segmentAStart, segmentBStart, segmentBEnd),
    getScreenPointToSegmentDistance(segmentAEnd, segmentBStart, segmentBEnd),
    getScreenPointToSegmentDistance(segmentBStart, segmentAStart, segmentAEnd),
    getScreenPointToSegmentDistance(segmentBEnd, segmentAStart, segmentAEnd),
  );
};

const segmentTouchesEraserPath = (
  segmentStart: ScreenPointLike,
  segmentEnd: ScreenPointLike,
  eraserPath: ScreenPointLike[],
  eraseRadiusPx: number,
) => {
  if (eraserPath.length === 1) {
    return getScreenPointToSegmentDistance(eraserPath[0]!, segmentStart, segmentEnd) <= eraseRadiusPx;
  }

  if (eraserPath.length >= 2) {
    return (
      getSegmentToSegmentDistance(
        segmentStart,
        segmentEnd,
        eraserPath[0]!,
        eraserPath[eraserPath.length - 1]!,
      ) <= eraseRadiusPx
    );
  }

  return false;
};

const interpolateScreenPoint = (start: ScreenPointLike, end: ScreenPointLike, t: number): ScreenPointLike => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
});

const interpolateCoordinate = (start: Position, end: Position, t: number): Position => [
  start[0] + (end[0] - start[0]) * t,
  start[1] + (end[1] - start[1]) * t,
];

const refineEraserBoundaryT = (
  segmentStart: ScreenPointLike,
  segmentEnd: ScreenPointLike,
  eraserPath: ScreenPointLike[],
  eraseRadiusPx: number,
  tStart: number,
  tEnd: number,
  startInside: boolean,
) => {
  let low = tStart;
  let high = tEnd;

  for (let step = 0; step < ERASER_TRIM_BINARY_STEPS; step += 1) {
    const mid = (low + high) / 2;
    const inside = getDistanceToEraserPath(
      interpolateScreenPoint(segmentStart, segmentEnd, mid),
      eraserPath,
    ) <= eraseRadiusPx;

    if (inside === startInside) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
};

const trimLineSegmentByEraser = (
  coordinateStart: Position,
  coordinateEnd: Position,
  projectedStart: ScreenPointLike,
  projectedEnd: ScreenPointLike,
  eraserPath: ScreenPointLike[],
  eraseRadiusPx: number,
) => {
  if (!segmentTouchesEraserPath(projectedStart, projectedEnd, eraserPath, eraseRadiusPx)) {
    return [[cloneCoordinate(coordinateStart), cloneCoordinate(coordinateEnd)]];
  }

  const samples = Array.from({ length: ERASER_TRIM_SAMPLES + 1 }, (_, index) => index / ERASER_TRIM_SAMPLES);
  const insideStates = samples.map(
    (t) => getDistanceToEraserPath(interpolateScreenPoint(projectedStart, projectedEnd, t), eraserPath) <= eraseRadiusPx,
  );

  if (insideStates.every(Boolean)) {
    return [];
  }

  const intervals: Array<{ inside: boolean; start: number; end: number }> = [];
  let currentInside = insideStates[0]!;
  let intervalStart = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const nextInside = insideStates[index]!;
    if (nextInside === currentInside) {
      continue;
    }

    const boundary = refineEraserBoundaryT(
      projectedStart,
      projectedEnd,
      eraserPath,
      eraseRadiusPx,
      samples[index - 1]!,
      samples[index]!,
      currentInside,
    );

    intervals.push({
      inside: currentInside,
      start: intervalStart,
      end: boundary,
    });
    currentInside = nextInside;
    intervalStart = boundary;
  }

  intervals.push({
    inside: currentInside,
    start: intervalStart,
    end: 1,
  });

  return intervals
    .filter((interval) => !interval.inside && interval.end - interval.start > ERASER_TRIM_EPSILON)
    .map((interval) => [
      interpolateCoordinate(coordinateStart, coordinateEnd, interval.start),
      interpolateCoordinate(coordinateStart, coordinateEnd, interval.end),
    ]);
};

const coordinatesAlmostEqual = (left: Position, right: Position) =>
  Math.abs(left[0] - right[0]) <= ERASER_TRIM_EPSILON &&
  Math.abs(left[1] - right[1]) <= ERASER_TRIM_EPSILON;

export const eraseLineStringCoordinates = (
  coordinates: Position[],
  projectedCoordinates: ScreenPointLike[],
  eraserPath: ScreenPointLike[],
  eraseRadiusPx: number,
) => {
  if (coordinates.length < 2 || projectedCoordinates.length !== coordinates.length || eraserPath.length === 0) {
    return {
      didErase: false,
      segments: [cloneCoordinates(coordinates)],
    };
  }

  const keptSegments: Position[][] = [];
  let currentSegment: Position[] = [];
  let didErase = false;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const coordinateStart = coordinates[index]!;
    const coordinateEnd = coordinates[index + 1]!;
    const projectedStart = projectedCoordinates[index]!;
    const projectedEnd = projectedCoordinates[index + 1]!;
    const trimmedPieces = trimLineSegmentByEraser(
      coordinateStart,
      coordinateEnd,
      projectedStart,
      projectedEnd,
      eraserPath,
      eraseRadiusPx,
    );

    if (trimmedPieces.length === 0) {
      didErase = true;
      if (currentSegment.length >= 2) {
        keptSegments.push(currentSegment);
      }
      currentSegment = [];
      continue;
    }

    if (
      trimmedPieces.length !== 1 ||
      !coordinatesAlmostEqual(trimmedPieces[0]![0]!, coordinateStart) ||
      !coordinatesAlmostEqual(trimmedPieces[0]![1]!, coordinateEnd)
    ) {
      didErase = true;
    }

    trimmedPieces.forEach((piece, pieceIndex) => {
      const [pieceStart, pieceEnd] = piece;

      if (currentSegment.length === 0) {
        currentSegment.push(cloneCoordinate(pieceStart));
      } else if (!coordinatesAlmostEqual(currentSegment[currentSegment.length - 1]!, pieceStart)) {
        if (currentSegment.length >= 2) {
          keptSegments.push(currentSegment);
        }
        currentSegment = [cloneCoordinate(pieceStart)];
      }

      currentSegment.push(cloneCoordinate(pieceEnd));

      if (pieceIndex < trimmedPieces.length - 1) {
        if (currentSegment.length >= 2) {
          keptSegments.push(currentSegment);
        }
        currentSegment = [];
      }
    });
  }

  if (currentSegment.length >= 2) {
    keptSegments.push(currentSegment);
  }

  return {
    didErase,
    segments: keptSegments,
  };
};

export const eraseFreeDrawObject = (
  object: MapcraftObject,
  projectCoordinate: (coordinate: Position) => ScreenPointLike,
  eraserPath: ScreenPointLike[],
  eraseRadiusPx: number,
) => {
  if (!isFreeDrawObject(object) || !isLineGeometry(object.geometry)) {
    return null;
  }

  const coordinates = object.geometry.coordinates;
  const projectedCoordinates = coordinates.map(projectCoordinate);
  const { didErase, segments } = eraseLineStringCoordinates(
    coordinates,
    projectedCoordinates,
    eraserPath,
    eraseRadiusPx,
  );

  if (!didErase) {
    return null;
  }

  const sourceObjectId = getSourceObjectId(object);
  return segments.map((segment) => ({
    ...structuredClone(object),
    id: createId(),
    meta: {
      ...structuredClone(object.meta),
      sourceObjectId,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: segment,
    },
  }));
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
  if ('sourceObjectId' in next.meta) {
    delete next.meta.sourceObjectId;
  }
  return next;
};

export const createPastedObject = (object: MapcraftObject, zoom: number): MapcraftObject => {
  const next = duplicateObject(object);
  const degreesPerPixel = 360 / (256 * Math.pow(2, zoom));
  const delta = degreesPerPixel * PASTE_OFFSET_PX;
  const nextGeometry = translateGeometry(next.geometry, delta, -delta);

  if (nextGeometry) {
    next.geometry = nextGeometry;
  }

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

export const findNearestSegment = (
  vertices: Position[],
  targetPoint: ScreenPointLike,
  projectCoordinate: (coordinate: Position) => ScreenPointLike,
  closed: boolean,
): SegmentHit | null => {
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  if (segmentCount <= 0) {
    return null;
  }

  let closest: SegmentHit | null = null;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = projectCoordinate(vertices[index]!);
    const end = projectCoordinate(vertices[(index + 1) % vertices.length]!);
    const distance = getScreenPointToSegmentDistance(targetPoint, start, end);

    if (!closest || distance < closest.distance) {
      closest = {
        segmentIndex: index,
        distance,
      };
    }
  }

  return closest;
};

export const insertVertexIntoObject = (
  object: MapcraftObject | null,
  segmentIndex: number,
  coordinate: Position,
): Geometry | null => {
  const vertices = getEditableVertices(object);
  if (!object || !vertices || object.type === 'point' || isFreeDrawObject(object)) {
    return null;
  }

  const maxSegmentIndex = object.type === 'polygon' ? vertices.length - 1 : vertices.length - 2;
  if (segmentIndex < 0 || segmentIndex > maxSegmentIndex) {
    return null;
  }

  const nextVertices = cloneCoordinates(vertices);
  nextVertices.splice(segmentIndex + 1, 0, cloneCoordinate(coordinate));
  return buildGeometryFromVertices(object.type, nextVertices);
};

export const deleteVertexFromObject = (
  object: MapcraftObject | null,
  vertexIndex: number,
): GeometryEditResult | null => {
  const vertices = getEditableVertices(object);
  if (!object || !vertices || object.type === 'point' || isFreeDrawObject(object)) {
    return null;
  }

  if (vertexIndex < 0 || vertexIndex >= vertices.length) {
    return null;
  }

  const nextVertices = vertices.filter((_, index) => index !== vertexIndex);
  const nextGeometry = buildGeometryFromVertices(object.type, nextVertices);

  if (!nextGeometry) {
    return {
      kind: 'delete',
    };
  }

  return {
    kind: 'update',
    geometry: nextGeometry,
  };
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
          sourceObjectId: getSourceObjectId(object),
          layerId: layer.id,
          layerLocked: layer.locked,
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
  snapCoordinate: Position | null = null,
): FeatureCollection<Geometry> => {
  if (vertices.length === 0 && !snapCoordinate) {
    return EMPTY_FEATURE_COLLECTION;
  }

  const features: Feature<Geometry>[] = vertices.map((coordinate, index) => ({
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
  }));

  if (snapCoordinate) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cloneCoordinate(snapCoordinate),
      },
      properties: { isSnapTarget: true },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
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
