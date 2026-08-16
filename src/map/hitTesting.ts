import type { Position } from 'geojson';
import type maplibregl from 'maplibre-gl';

import type { MapcraftLayer, MapcraftObject, MapObjectType } from '../types/project';
import { OBJECT_INTERACTIVE_LAYER_IDS } from './constants';
import type { ScreenPoint } from './types';

export interface ObjectHitResult {
  objectId: string;
  layerId: string;
  objectType: MapObjectType;
  source: 'rendered' | 'geometry';
}

const POINT_HIT_RADIUS = 14;
const POLYGON_EDGE_HIT_RADIUS = 8;

const distanceBetweenPoints = (first: ScreenPoint, second: ScreenPoint) =>
  Math.hypot(first.x - second.x, first.y - second.y);

export const getPointToSegmentDistance = (
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return distanceBetweenPoints(point, start);
  }

  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared),
  );
  return distanceBetweenPoints(point, {
    x: start.x + progress * deltaX,
    y: start.y + progress * deltaY,
  });
};

const isCoordinateInRing = (coordinate: Position, ring: Position[]) => {
  const [x, y] = coordinate;
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crossesLatitude = currentY > y !== previousY > y;

    if (
      crossesLatitude &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
    ) {
      inside = !inside;
    }
  }

  return inside;
};

const getMinimumPathDistance = (
  point: ScreenPoint,
  coordinates: Position[],
  project: (coordinate: Position) => ScreenPoint,
  closed: boolean,
) => {
  const segmentCount = closed ? coordinates.length : coordinates.length - 1;
  let minimumDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = coordinates[index];
    const end = coordinates[(index + 1) % coordinates.length];
    if (!start || !end) {
      continue;
    }

    minimumDistance = Math.min(
      minimumDistance,
      getPointToSegmentDistance(point, project(start), project(end)),
    );
  }

  return minimumDistance;
};

const isGeometryHit = (
  object: MapcraftObject,
  point: ScreenPoint,
  coordinate: Position,
  project: (coordinate: Position) => ScreenPoint,
) => {
  const { geometry } = object;

  if (geometry.type === 'Point') {
    return distanceBetweenPoints(point, project(geometry.coordinates)) <= POINT_HIT_RADIUS;
  }

  if (geometry.type === 'LineString') {
    const hitRadius = Math.max(8, object.style.strokeWidth / 2 + 7);
    return getMinimumPathDistance(point, geometry.coordinates, project, false) <= hitRadius;
  }

  if (geometry.type === 'Polygon') {
    const [outerRing, ...holes] = geometry.coordinates;
    if (!outerRing) {
      return false;
    }

    const insideFill =
      isCoordinateInRing(coordinate, outerRing) &&
      !holes.some((hole) => isCoordinateInRing(coordinate, hole));
    if (insideFill) {
      return true;
    }

    return geometry.coordinates.some(
      (ring) => getMinimumPathDistance(point, ring, project, true) <= POLYGON_EDGE_HIT_RADIUS,
    );
  }

  return false;
};

const findObject = (layers: MapcraftLayer[], layerId: string, objectId: string) => {
  const layer = layers.find((candidate) => candidate.id === layerId);
  if (!layer || !layer.visible || layer.locked) {
    return null;
  }

  const object = layer.objects.find((candidate) => candidate.id === objectId);
  return object ? { layer, object } : null;
};

export const hitTestObject = (
  map: maplibregl.Map,
  layers: MapcraftLayer[],
  point: ScreenPoint,
  coordinate: Position,
): ObjectHitResult | null => {
  const renderedLayerIds = OBJECT_INTERACTIVE_LAYER_IDS.filter((layerId) => map.getLayer(layerId));
  const renderedFeatures = renderedLayerIds.length
    ? map.queryRenderedFeatures([point.x, point.y], { layers: renderedLayerIds })
    : [];

  for (const feature of renderedFeatures) {
    const objectId = feature.properties?.objectId;
    const layerId = feature.properties?.layerId;
    if (objectId === undefined || layerId === undefined) {
      continue;
    }

    const match = findObject(layers, String(layerId), String(objectId));
    if (match) {
      return {
        objectId: match.object.id,
        layerId: match.layer.id,
        objectType: match.object.type,
        source: 'rendered',
      };
    }
  }

  const project = (position: Position): ScreenPoint => {
    const projected = map.project({ lng: position[0], lat: position[1] });
    return { x: projected.x, y: projected.y };
  };

  for (const layer of layers) {
    if (!layer.visible || layer.locked) {
      continue;
    }

    for (let index = layer.objects.length - 1; index >= 0; index -= 1) {
      const object = layer.objects[index];
      if (object && isGeometryHit(object, point, coordinate, project)) {
        return {
          objectId: object.id,
          layerId: layer.id,
          objectType: object.type,
          source: 'geometry',
        };
      }
    }
  }

  return null;
};
