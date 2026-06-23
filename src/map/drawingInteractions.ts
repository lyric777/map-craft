import type { Position } from 'geojson';
import type { MapMouseEvent } from 'maplibre-gl';

import {
  eraseFreeDrawObject,
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
  getSourceObjectId,
  isFreeDrawObject,
  processFreeDrawCoordinates,
} from '../lib/project';
import { ERASER_POINT_THRESHOLD, ERASER_RADIUS_PX, FREE_DRAW_POINT_THRESHOLD } from './constants';
import type { MapInteractionBindings } from './interactionBindings';
import type { ScreenPoint } from './types';

export const createDrawingHandlers = ({
  map,
  currentToolRef,
  projectLayersRef,
  selectedLayerIdRef,
  addObjectToSelectedLayer,
  replaceObjectsById,
  draftCoordinatesRef,
  closeToStartRef,
  dragMovedRef,
  freeDrawScreenPointsRef,
  isFreeDrawingRef,
  isErasingRef,
  eraserPreviewReplacementsRef,
  setDraftCoordinates,
  setHoverCoordinate,
  setFreeDrawScreenPoints,
  setIsFreeDrawing,
  setEraserPreviewReplacements,
  updateCanvasCursor,
  resetFreeDraw,
}: MapInteractionBindings) => {
  let eraserScreenPoints: ScreenPoint[] = [];

  const appendEraserPoint = (point: ScreenPoint) => {
    const previousPoint = eraserScreenPoints.at(-1);
    if (!previousPoint) {
      eraserScreenPoints = [point];
      return false;
    }

    const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
    if (distance >= ERASER_POINT_THRESHOLD) {
      eraserScreenPoints = [previousPoint, point];
      return true;
    }

    return false;
  };

  const buildEraserPreviewReplacements = () => {
    const replacementMap = new Map(
      eraserPreviewReplacementsRef.current.map((entry) => [entry.objectId, entry.objects] as const),
    );
    const sourceObjectIds = new Set([
      ...replacementMap.keys(),
      ...projectLayersRef.current
        .flatMap((layer) => layer.objects)
        .filter(isFreeDrawObject)
        .map(getSourceObjectId),
    ]);

    sourceObjectIds.forEach((sourceObjectId) => {
      const baseObjects =
        replacementMap.get(sourceObjectId) ??
        projectLayersRef.current
          .flatMap((layer) => layer.objects)
          .filter((candidate) => getSourceObjectId(candidate) === sourceObjectId);

      if (baseObjects.length === 0) {
        return;
      }

      let didChange = false;
      const nextObjects = baseObjects.flatMap((object) => {
        const erasedObjects = eraseFreeDrawObject(
          object,
          (coordinate) => {
            const projected = map.project({ lng: coordinate[0], lat: coordinate[1] });
            return { x: projected.x, y: projected.y };
          },
          eraserScreenPoints,
          ERASER_RADIUS_PX,
        );

        if (!erasedObjects) {
          return [object];
        }

        didChange = true;
        return erasedObjects;
      });

      if (didChange) {
        replacementMap.set(sourceObjectId, nextObjects);
      }
    });

    return [...replacementMap.entries()].map(([objectId, objects]) => ({ objectId, objects }));
  };

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
      eraserScreenPoints = [{ x: event.point.x, y: event.point.y }];
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
      const didAdvance = appendEraserPoint({ x: event.point.x, y: event.point.y });
      if (didAdvance) {
        const replacements = buildEraserPreviewReplacements();
        eraserPreviewReplacementsRef.current = replacements;
        setEraserPreviewReplacements(replacements);
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
      isErasingRef.current = false;
      const replacements = eraserPreviewReplacementsRef.current;

      if (replacements.length > 0) {
        replaceObjectsById(replacements);
      }

      eraserScreenPoints = [];
      eraserPreviewReplacementsRef.current = [];
      setEraserPreviewReplacements([]);
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
