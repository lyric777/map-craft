import type { Position } from 'geojson';

import { getEditableVertices, isFreeDrawObject } from '../lib/project';
import type { MapcraftLayer, MapcraftObject } from '../types/project';
import type { ScreenPoint } from './types';

export const VERTEX_SNAP_DISTANCE_PX = 10;

const getObjectSnapVertices = (object: MapcraftLayer['objects'][number]): Position[] => {
  if (isFreeDrawObject(object)) {
    return [];
  }

  if (object.geometry.type === 'Point') {
    return [object.geometry.coordinates];
  }

  return getEditableVertices(object) ?? [];
};

const getTargetVertices = (layers: MapcraftLayer[], excludedObjectId: string): Position[] =>
  layers.flatMap((layer) => {
    if (!layer.visible || layer.locked) {
      return [];
    }

    return layer.objects.flatMap((object) =>
      object.id === excludedObjectId ? [] : getObjectSnapVertices(object),
    );
  });

export const findNearestSnapVertex = (
  layers: MapcraftLayer[],
  excludedObjectId: string,
  pointer: ScreenPoint,
  projectCoordinate: (coordinate: Position) => ScreenPoint,
  maxDistance = VERTEX_SNAP_DISTANCE_PX,
): Position | null => {
  let nearest: { coordinate: Position; distance: number } | null = null;

  for (const coordinate of getTargetVertices(layers, excludedObjectId)) {
    const projected = projectCoordinate(coordinate);
    const distance = Math.hypot(projected.x - pointer.x, projected.y - pointer.y);
    if (distance <= maxDistance && (!nearest || distance < nearest.distance)) {
      nearest = { coordinate, distance };
    }
  }

  return nearest ? [...nearest.coordinate] : null;
};

export interface ObjectSnapTranslation {
  deltaLng: number;
  deltaLat: number;
  targetCoordinate: Position;
}

export const findObjectSnapTranslation = (
  layers: MapcraftLayer[],
  movingObject: MapcraftObject,
  projectCoordinate: (coordinate: Position) => ScreenPoint,
  maxDistance = VERTEX_SNAP_DISTANCE_PX,
): ObjectSnapTranslation | null => {
  const movingVertices = getObjectSnapVertices(movingObject);
  const targetVertices = getTargetVertices(layers, movingObject.id);
  let nearest: ObjectSnapTranslation & { distance: number } | null = null;

  for (const movingCoordinate of movingVertices) {
    const movingPoint = projectCoordinate(movingCoordinate);
    for (const targetCoordinate of targetVertices) {
      const targetPoint = projectCoordinate(targetCoordinate);
      const distance = Math.hypot(targetPoint.x - movingPoint.x, targetPoint.y - movingPoint.y);
      if (distance <= maxDistance && (!nearest || distance < nearest.distance)) {
        nearest = {
          deltaLng: targetCoordinate[0] - movingCoordinate[0],
          deltaLat: targetCoordinate[1] - movingCoordinate[1],
          targetCoordinate: [...targetCoordinate],
          distance,
        };
      }
    }
  }

  if (!nearest) {
    return null;
  }

  return {
    deltaLng: nearest.deltaLng,
    deltaLat: nearest.deltaLat,
    targetCoordinate: nearest.targetCoordinate,
  };
};
