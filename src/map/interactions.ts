import type { Geometry, Position } from 'geojson';
import type { MapGeoJSONFeature, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import maplibregl from 'maplibre-gl';

import {
  buildGeometryFromVertices,
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
  getEditableVertices,
  translateGeometry,
} from '../lib/project';
import type { MapcraftObject } from '../types/project';
import { OBJECT_INTERACTIVE_LAYER_IDS, FREE_DRAW_POINT_THRESHOLD } from './constants';
import type { ScreenPoint } from './types';

const isFeatureSelectable = (feature: MapGeoJSONFeature | undefined): feature is MapGeoJSONFeature =>
  Boolean(feature?.properties?.objectId);

interface MapInteractionBindings {
  map: maplibregl.Map;
  currentToolRef: MutableRefObject<'move' | 'freeDraw' | 'point' | 'line' | 'polygon'>;
  selectedLayerIdRef: MutableRefObject<string | null>;
  selectedObjectRef: MutableRefObject<MapcraftObject | null>;
  selectObjectRef: MutableRefObject<(objectId: string | null, layerId?: string | null) => void>;
  updateSelectedObjectGeometryRef: MutableRefObject<(geometry: Geometry) => void>;
  addObjectToSelectedLayer: (object: MapcraftObject) => void;
  draftCoordinatesRef: MutableRefObject<Position[]>;
  closeToStartRef: MutableRefObject<boolean>;
  hoverVertexIndexRef: MutableRefObject<number | null>;
  dragVertexIndexRef: MutableRefObject<number | null>;
  previewVerticesRef: MutableRefObject<Position[] | null>;
  hoverObjectIdRef: MutableRefObject<string | null>;
  dragObjectIdRef: MutableRefObject<string | null>;
  previewObjectGeometryRef: MutableRefObject<Geometry | null>;
  objectDragStartRef: MutableRefObject<Position | null>;
  objectDragGeometryRef: MutableRefObject<Geometry | null>;
  dragMovedRef: MutableRefObject<boolean>;
  freeDrawScreenPointsRef: MutableRefObject<ScreenPoint[]>;
  isFreeDrawingRef: MutableRefObject<boolean>;
  setDraftCoordinates: Dispatch<SetStateAction<Position[]>>;
  setHoverCoordinate: Dispatch<SetStateAction<Position | null>>;
  setHoverVertexIndex: Dispatch<SetStateAction<number | null>>;
  setDragVertexIndex: Dispatch<SetStateAction<number | null>>;
  setPreviewVertices: Dispatch<SetStateAction<Position[] | null>>;
  setHoverObjectId: Dispatch<SetStateAction<string | null>>;
  setDragObjectId: Dispatch<SetStateAction<string | null>>;
  setPreviewObjectGeometry: Dispatch<SetStateAction<Geometry | null>>;
  setFreeDrawScreenPoints: Dispatch<SetStateAction<ScreenPoint[]>>;
  setIsFreeDrawing: Dispatch<SetStateAction<boolean>>;
  updateCanvasCursor: () => void;
  resetVertexEditing: () => void;
  resetFreeDraw: () => void;
}

export const bindMapInteractions = ({
  map,
  currentToolRef,
  selectedLayerIdRef,
  selectedObjectRef,
  selectObjectRef,
  updateSelectedObjectGeometryRef,
  addObjectToSelectedLayer,
  draftCoordinatesRef,
  closeToStartRef,
  hoverVertexIndexRef,
  dragVertexIndexRef,
  previewVerticesRef,
  hoverObjectIdRef,
  dragObjectIdRef,
  previewObjectGeometryRef,
  objectDragStartRef,
  objectDragGeometryRef,
  dragMovedRef,
  freeDrawScreenPointsRef,
  isFreeDrawingRef,
  setDraftCoordinates,
  setHoverCoordinate,
  setHoverVertexIndex,
  setDragVertexIndex,
  setPreviewVertices,
  setHoverObjectId,
  setDragObjectId,
  setPreviewObjectGeometry,
  setFreeDrawScreenPoints,
  setIsFreeDrawing,
  updateCanvasCursor,
  resetVertexEditing,
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

  const handleObjectMouseEnter = (event: MapLayerMouseEvent) => {
    if (
      currentToolRef.current !== 'move' ||
      dragVertexIndexRef.current !== null ||
      dragObjectIdRef.current !== null
    ) {
      return;
    }

    const feature = event.features?.[0];
    if (!isFeatureSelectable(feature)) {
      return;
    }

    hoverObjectIdRef.current = String(feature.properties.objectId);
    setHoverObjectId(String(feature.properties.objectId));
    updateCanvasCursor();
  };

  const handleObjectMouseLeave = () => {
    if (dragObjectIdRef.current !== null || dragVertexIndexRef.current !== null) {
      return;
    }

    hoverObjectIdRef.current = null;
    setHoverObjectId(null);
    updateCanvasCursor();
  };

  const handleObjectMouseDown = (event: MapLayerMouseEvent) => {
    if (
      currentToolRef.current !== 'move' ||
      dragVertexIndexRef.current !== null ||
      hoverVertexIndexRef.current !== null
    ) {
      return;
    }

    const feature = event.features?.[0];
    if (!isFeatureSelectable(feature)) {
      return;
    }

    const objectId = String(feature.properties.objectId);
    if (objectId !== selectedObjectRef.current?.id || !selectedObjectRef.current) {
      return;
    }

    event.preventDefault();
    dragObjectIdRef.current = objectId;
    hoverObjectIdRef.current = objectId;
    objectDragStartRef.current = [event.lngLat.lng, event.lngLat.lat];
    objectDragGeometryRef.current = structuredClone(selectedObjectRef.current.geometry);
    dragMovedRef.current = false;
    setDragObjectId(objectId);
    setHoverObjectId(objectId);
    map.dragPan.disable();
    updateCanvasCursor();
  };

  const handleVertexMouseEnter = (event: MapLayerMouseEvent) => {
    if (currentToolRef.current !== 'move' || dragVertexIndexRef.current !== null) {
      return;
    }

    const feature = event.features?.[0];
    const nextIndex = Number(feature?.properties?.vertexIndex);
    if (Number.isNaN(nextIndex)) {
      return;
    }

    hoverVertexIndexRef.current = nextIndex;
    setHoverVertexIndex(nextIndex);
    updateCanvasCursor();
  };

  const handleVertexMouseLeave = () => {
    if (dragVertexIndexRef.current !== null) {
      return;
    }

    hoverVertexIndexRef.current = null;
    setHoverVertexIndex(null);
    updateCanvasCursor();
  };

  const handleVertexMouseDown = (event: MapLayerMouseEvent) => {
    if (currentToolRef.current !== 'move') {
      return;
    }

    const feature = event.features?.[0];
    const nextIndex = Number(feature?.properties?.vertexIndex);
    const baseVertices = getEditableVertices(selectedObjectRef.current);
    if (Number.isNaN(nextIndex) || !baseVertices) {
      return;
    }

    event.preventDefault();
    dragVertexIndexRef.current = nextIndex;
    hoverVertexIndexRef.current = nextIndex;
    dragObjectIdRef.current = null;
    hoverObjectIdRef.current = null;
    previewVerticesRef.current = baseVertices;
    dragMovedRef.current = false;
    setDragVertexIndex(nextIndex);
    setHoverVertexIndex(nextIndex);
    setDragObjectId(null);
    setHoverObjectId(null);
    setPreviewVertices(baseVertices);
    map.dragPan.disable();
    updateCanvasCursor();
  };

  const handleMapClick = (event: MapMouseEvent) => {
    if (currentToolRef.current === 'freeDraw') {
      return;
    }

    if (currentToolRef.current === 'move') {
      const interactiveFeatures = map.queryRenderedFeatures(event.point, {
        layers: [...OBJECT_INTERACTIVE_LAYER_IDS],
      });

      const selectableFeature = interactiveFeatures.find(isFeatureSelectable);
      if (selectableFeature) {
        selectObjectRef.current(
          String(selectableFeature.properties.objectId),
          String(selectableFeature.properties.layerId),
        );
      } else {
        selectObjectRef.current(null, selectedLayerIdRef.current);
      }
      return;
    }

    if (currentToolRef.current === 'point') {
      const coordinate: Position = [event.lngLat.lng, event.lngLat.lat];
      addObjectToSelectedLayer(createPointObject(coordinate));
      setHoverCoordinate(null);
      return;
    }

    if (currentToolRef.current === 'line' || currentToolRef.current === 'polygon') {
      if (currentToolRef.current === 'polygon' && closeToStartRef.current) {
        finishPolygon();
        return;
      }

      const nextCoord: Position = [event.lngLat.lng, event.lngLat.lat];
      setDraftCoordinates((coords) => {
        const next = [...coords, nextCoord];
        draftCoordinatesRef.current = next;
        return next;
      });
      setHoverCoordinate(nextCoord);
    }
  };

  const handleMouseDown = (event: MapMouseEvent) => {
    if (currentToolRef.current !== 'freeDraw') {
      return;
    }

    dragMovedRef.current = false;
    const nextPoints = [{ x: event.point.x, y: event.point.y }];
    freeDrawScreenPointsRef.current = nextPoints;
    isFreeDrawingRef.current = true;
    setFreeDrawScreenPoints(nextPoints);
    setIsFreeDrawing(true);
    map.dragPan.disable();
    updateCanvasCursor();
  };

  const handleDoubleClick = (event: MapMouseEvent) => {
    if (currentToolRef.current !== 'polygon' && currentToolRef.current !== 'line') {
      return;
    }

    event.originalEvent.preventDefault();
    if (currentToolRef.current === 'polygon') {
      finishPolygon();
    } else {
      finishLine();
    }
  };

  const handleMouseMove = (event: MapMouseEvent) => {
    const activeVertexIndex = dragVertexIndexRef.current;
    if (activeVertexIndex !== null) {
      const baseVertices = previewVerticesRef.current ?? getEditableVertices(selectedObjectRef.current);
      if (!baseVertices) {
        return;
      }

      dragMovedRef.current = true;
      const nextVertices = baseVertices.map((coordinate, index) =>
        index === activeVertexIndex ? ([event.lngLat.lng, event.lngLat.lat] as Position) : coordinate,
      );
      previewVerticesRef.current = nextVertices;
      setPreviewVertices(nextVertices);
      return;
    }

    const activeObjectId = dragObjectIdRef.current;
    const dragOrigin = objectDragStartRef.current;
    const baseGeometry = objectDragGeometryRef.current;
    if (activeObjectId && dragOrigin && baseGeometry) {
      const deltaLng = event.lngLat.lng - dragOrigin[0];
      const deltaLat = event.lngLat.lat - dragOrigin[1];
      const nextGeometry = translateGeometry(baseGeometry, deltaLng, deltaLat);
      if (!nextGeometry) {
        return;
      }

      dragMovedRef.current = true;
      previewObjectGeometryRef.current = nextGeometry;
      setPreviewObjectGeometry(nextGeometry);
      return;
    }

    if (isFreeDrawingRef.current && currentToolRef.current === 'freeDraw') {
      const previousPoint = freeDrawScreenPointsRef.current.at(-1);
      if (!previousPoint) {
        return;
      }

      const distance = Math.hypot(event.point.x - previousPoint.x, event.point.y - previousPoint.y);
      if (distance < FREE_DRAW_POINT_THRESHOLD) {
        return;
      }

      dragMovedRef.current = true;
      const nextPoints = [...freeDrawScreenPointsRef.current, { x: event.point.x, y: event.point.y }];
      freeDrawScreenPointsRef.current = nextPoints;
      setFreeDrawScreenPoints(nextPoints);
      return;
    }

    if (
      (currentToolRef.current !== 'polygon' && currentToolRef.current !== 'line') ||
      draftCoordinatesRef.current.length === 0
    ) {
      setHoverCoordinate(null);
      return;
    }

    setHoverCoordinate([event.lngLat.lng, event.lngLat.lat]);
  };

  const handleMouseUp = () => {
    if (isFreeDrawingRef.current && currentToolRef.current === 'freeDraw') {
      const coordinates = freeDrawScreenPointsRef.current.map(({ x, y }) => {
        const coordinate = map.unproject([x, y]);
        return [coordinate.lng, coordinate.lat] as Position;
      });

      resetFreeDraw();

      if (dragMovedRef.current && coordinates.length >= 2) {
        addObjectToSelectedLayer(createFreeDrawObject(coordinates));
      }
      return;
    }

    const activeVertexIndex = dragVertexIndexRef.current;
    const vertices = previewVerticesRef.current;
    const object = selectedObjectRef.current;
    if (activeVertexIndex !== null) {
      const nextGeometry =
        dragMovedRef.current && vertices && object
          ? buildGeometryFromVertices(object.type, vertices)
          : null;
      resetVertexEditing();

      if (nextGeometry) {
        updateSelectedObjectGeometryRef.current(nextGeometry);
      }
      return;
    }

    const activeObjectId = dragObjectIdRef.current;
    if (activeObjectId) {
      const draggedObjectGeometry = dragMovedRef.current ? previewObjectGeometryRef.current : null;
      resetVertexEditing();
      if (draggedObjectGeometry) {
        updateSelectedObjectGeometryRef.current(draggedObjectGeometry);
      }
    }
  };

  const handleMouseOut = () => {
    if (dragVertexIndexRef.current === null) {
      setHoverCoordinate(null);
    }
  };

  map.on('mouseenter', 'polygon-fill-hit', handleObjectMouseEnter);
  map.on('mouseenter', 'polygon-line-hit', handleObjectMouseEnter);
  map.on('mouseenter', 'line-string-hit', handleObjectMouseEnter);
  map.on('mouseenter', 'points-hit', handleObjectMouseEnter);
  map.on('mouseleave', 'polygon-fill-hit', handleObjectMouseLeave);
  map.on('mouseleave', 'polygon-line-hit', handleObjectMouseLeave);
  map.on('mouseleave', 'line-string-hit', handleObjectMouseLeave);
  map.on('mouseleave', 'points-hit', handleObjectMouseLeave);
  map.on('mousedown', 'polygon-fill-hit', handleObjectMouseDown);
  map.on('mousedown', 'polygon-line-hit', handleObjectMouseDown);
  map.on('mousedown', 'line-string-hit', handleObjectMouseDown);
  map.on('mousedown', 'points-hit', handleObjectMouseDown);
  map.on('mouseenter', 'edit-vertex-hit', handleVertexMouseEnter);
  map.on('mouseleave', 'edit-vertex-hit', handleVertexMouseLeave);
  map.on('mousedown', 'edit-vertex-hit', handleVertexMouseDown);
  map.on('mousedown', handleMouseDown);
  map.on('click', handleMapClick);
  map.on('dblclick', handleDoubleClick);
  map.on('mousemove', handleMouseMove);
  map.on('mouseup', handleMouseUp);
  map.on('mouseout', handleMouseOut);

  return () => {
    map.off('mouseenter', 'polygon-fill-hit', handleObjectMouseEnter);
    map.off('mouseenter', 'polygon-line-hit', handleObjectMouseEnter);
    map.off('mouseenter', 'line-string-hit', handleObjectMouseEnter);
    map.off('mouseenter', 'points-hit', handleObjectMouseEnter);
    map.off('mouseleave', 'polygon-fill-hit', handleObjectMouseLeave);
    map.off('mouseleave', 'polygon-line-hit', handleObjectMouseLeave);
    map.off('mouseleave', 'line-string-hit', handleObjectMouseLeave);
    map.off('mouseleave', 'points-hit', handleObjectMouseLeave);
    map.off('mousedown', 'polygon-fill-hit', handleObjectMouseDown);
    map.off('mousedown', 'polygon-line-hit', handleObjectMouseDown);
    map.off('mousedown', 'line-string-hit', handleObjectMouseDown);
    map.off('mousedown', 'points-hit', handleObjectMouseDown);
    map.off('mouseenter', 'edit-vertex-hit', handleVertexMouseEnter);
    map.off('mouseleave', 'edit-vertex-hit', handleVertexMouseLeave);
    map.off('mousedown', 'edit-vertex-hit', handleVertexMouseDown);
    map.off('mousedown', handleMouseDown);
    map.off('click', handleMapClick);
    map.off('dblclick', handleDoubleClick);
    map.off('mousemove', handleMouseMove);
    map.off('mouseup', handleMouseUp);
    map.off('mouseout', handleMouseOut);
  };
};
