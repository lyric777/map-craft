import type { Position } from 'geojson';
import type { MapMouseEvent } from 'maplibre-gl';

import {
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
  processFreeDrawCoordinates,
} from '../lib/project';
import { FREE_DRAW_POINT_THRESHOLD } from './constants';
import type { MapInteractionBindings } from './interactionBindings';

export const createDrawingHandlers = ({
  map,
  currentToolRef,
  selectedLayerIdRef,
  addObjectToSelectedLayer,
  draftCoordinatesRef,
  closeToStartRef,
  dragMovedRef,
  freeDrawScreenPointsRef,
  isFreeDrawingRef,
  isErasingRef,
  erasedObjectIdsRef,
  deleteObjectsByIds,
  setDraftCoordinates,
  setHoverCoordinate,
  setFreeDrawScreenPoints,
  setIsFreeDrawing,
  setErasedObjectIds,
  updateCanvasCursor,
  resetFreeDraw,
}: MapInteractionBindings) => {
  const finishPolygon = () => {
    const coords = draftCoordinatesRef.current;
    const layerId = selectedLayerIdRef.current;
    if (coords.length < 3 || !layerId) {
      return;
    }

    addObjectToSelectedLayer(createPolygonObject([...coords, coords[0]] as number[][]));
    draftCoordinatesRef.current = [];
    setDraftCoordinates([]);
    setHoverCoordinate(null);
  };

  const finishLine = () => {
    const coords = draftCoordinatesRef.current;
    const layerId = selectedLayerIdRef.current;
    if (coords.length < 2 || !layerId) {
      return;
    }

    addObjectToSelectedLayer(createLineObject(coords));
    draftCoordinatesRef.current = [];
    setDraftCoordinates([]);
    setHoverCoordinate(null);
  };

  const handleMapClick = (event: MapMouseEvent) => {
    if (currentToolRef.current === 'freeDraw' || currentToolRef.current === 'move' || currentToolRef.current === 'eraser') {
      return false;
    }

    if (currentToolRef.current === 'point') {
      const coordinate: Position = [event.lngLat.lng, event.lngLat.lat];
      addObjectToSelectedLayer(createPointObject(coordinate));
      setHoverCoordinate(null);
      return true;
    }

    if (currentToolRef.current === 'line' || currentToolRef.current === 'polygon') {
      if (currentToolRef.current === 'polygon' && closeToStartRef.current) {
        finishPolygon();
        return true;
      }

      const nextCoord: Position = [event.lngLat.lng, event.lngLat.lat];
      setDraftCoordinates((coords) => {
        const next = [...coords, nextCoord];
        draftCoordinatesRef.current = next;
        return next;
      });
      setHoverCoordinate(nextCoord);
      return true;
    }

    return false;
  };

  const handleMouseDown = (event: MapMouseEvent) => {
    if (currentToolRef.current === 'eraser') {
      isErasingRef.current = true;
      if (erasedObjectIdsRef.current.size > 0) {
        erasedObjectIdsRef.current = new Set();
        setErasedObjectIds([]);
      }

      const hitFeatures = map.queryRenderedFeatures(event.point, {
        layers: ['line-string-hit'],
      });
      const nextIds = new Set(erasedObjectIdsRef.current);
      hitFeatures.forEach((feature) => {
        const objectId = feature.properties?.objectId;
        const isFreeDraw = Boolean(feature.properties?.isFreeDraw);
        if (typeof objectId === 'string' && isFreeDraw) {
          nextIds.add(objectId);
        }
      });

      if (nextIds.size !== erasedObjectIdsRef.current.size) {
        erasedObjectIdsRef.current = nextIds;
        setErasedObjectIds([...nextIds]);
      }

      map.dragPan.disable();
      updateCanvasCursor();
      return true;
    }

    if (currentToolRef.current !== 'freeDraw') {
      return false;
    }

    dragMovedRef.current = false;
    const nextPoints = [{ x: event.point.x, y: event.point.y }];
    freeDrawScreenPointsRef.current = nextPoints;
    isFreeDrawingRef.current = true;
    setFreeDrawScreenPoints(nextPoints);
    setIsFreeDrawing(true);
    map.dragPan.disable();
    updateCanvasCursor();
    return true;
  };

  const handleDoubleClick = (event: MapMouseEvent) => {
    if (currentToolRef.current !== 'polygon' && currentToolRef.current !== 'line') {
      return false;
    }

    event.originalEvent.preventDefault();
    if (currentToolRef.current === 'polygon') {
      finishPolygon();
    } else {
      finishLine();
    }
    return true;
  };

  const handleMouseMove = (event: MapMouseEvent) => {
    if (isErasingRef.current && currentToolRef.current === 'eraser') {
      const hitFeatures = map.queryRenderedFeatures(event.point, {
        layers: ['line-string-hit'],
      });
      const nextIds = new Set(erasedObjectIdsRef.current);
      hitFeatures.forEach((feature) => {
        const objectId = feature.properties?.objectId;
        const isFreeDraw = Boolean(feature.properties?.isFreeDraw);
        if (typeof objectId === 'string' && isFreeDraw) {
          nextIds.add(objectId);
        }
      });

      if (nextIds.size !== erasedObjectIdsRef.current.size) {
        erasedObjectIdsRef.current = nextIds;
        setErasedObjectIds([...nextIds]);
      }

      return true;
    }

    if (isFreeDrawingRef.current && currentToolRef.current === 'freeDraw') {
      const previousPoint = freeDrawScreenPointsRef.current.at(-1);
      if (!previousPoint) {
        return true;
      }

      const distance = Math.hypot(event.point.x - previousPoint.x, event.point.y - previousPoint.y);
      if (distance < FREE_DRAW_POINT_THRESHOLD) {
        return true;
      }

      dragMovedRef.current = true;
      const nextPoints = [...freeDrawScreenPointsRef.current, { x: event.point.x, y: event.point.y }];
      freeDrawScreenPointsRef.current = nextPoints;
      setFreeDrawScreenPoints(nextPoints);
      return true;
    }

    if (
      (currentToolRef.current !== 'polygon' && currentToolRef.current !== 'line') ||
      draftCoordinatesRef.current.length === 0
    ) {
      setHoverCoordinate(null);
      return false;
    }

    setHoverCoordinate([event.lngLat.lng, event.lngLat.lat]);
    return true;
  };

  const handleMouseUp = () => {
    if (isErasingRef.current && currentToolRef.current === 'eraser') {
      const erasedIds = [...erasedObjectIdsRef.current];
      isErasingRef.current = false;

      if (erasedIds.length > 0) {
        deleteObjectsByIds(erasedIds);
      }

      erasedObjectIdsRef.current = new Set();
      setErasedObjectIds([]);
      if (!map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
      updateCanvasCursor();
      return true;
    }

    if (isFreeDrawingRef.current && currentToolRef.current === 'freeDraw') {
      const coordinates = freeDrawScreenPointsRef.current.map(({ x, y }) => {
        const coordinate = map.unproject([x, y]);
        return [coordinate.lng, coordinate.lat] as Position;
      });

      resetFreeDraw();

      if (dragMovedRef.current && coordinates.length >= 2) {
        addObjectToSelectedLayer(createFreeDrawObject(processFreeDrawCoordinates(coordinates)));
      }
      return true;
    }

    return false;
  };

  return {
    handleMapClick,
    handleMouseDown,
    handleDoubleClick,
    handleMouseMove,
    handleMouseUp,
  };
};
