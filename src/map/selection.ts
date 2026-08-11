import type { Position } from 'geojson';

import type { MapcraftLayer } from '../types/project';

const isCoordinateInRing = (coordinate: Position, ring: Position[]) => {
  const [x, y] = coordinate;
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crossesLatitude = currentY > y !== previousY > y;
    const intersectionX =
      ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;

    if (crossesLatitude && x < intersectionX) {
      inside = !inside;
    }
  }

  return inside;
};

export const findSelectablePolygonAtCoordinate = (
  layers: MapcraftLayer[],
  coordinate: Position,
) => {
  for (const layer of layers) {
    if (!layer.visible || layer.locked) {
      continue;
    }

    for (const object of [...layer.objects].reverse()) {
      if (object.geometry.type !== 'Polygon') {
        continue;
      }

      const [outerRing, ...holes] = object.geometry.coordinates;
      if (
        outerRing &&
        isCoordinateInRing(coordinate, outerRing) &&
        !holes.some((hole) => isCoordinateInRing(coordinate, hole))
      ) {
        return { objectId: object.id, layerId: layer.id };
      }
    }
  }

  return null;
};
