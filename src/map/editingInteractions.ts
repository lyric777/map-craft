import type { Position } from 'geojson';
import type { MapGeoJSONFeature, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';

import {
  buildGeometryFromVertices,
  deleteVertexFromObject,
  findNearestSegment,
  getEditableVertices,
  insertVertexIntoObject,
  isFreeDrawObject,
  translateGeometry,
} from '../lib/project';
import { OBJECT_INTERACTIVE_LAYER_IDS } from './constants';
import type { MapInteractionBindings } from './interactionBindings';

const isFeatureSelectable = (feature: MapGeoJSONFeature | undefined): feature is MapGeoJSONFeature =>
  Boolean(feature?.properties?.objectId);

const isFeatureLocked = (feature: MapGeoJSONFeature | undefined) =>
  Boolean(feature?.properties?.layerLocked);

export const createEditingHandlers = ({
  map,
  currentToolRef,
  projectLayersRef,
  selectedLayerIdRef,
  selectedObjectRef,
  geometryEditModeRef,
  selectObjectRef,
  updateSelectedObjectGeometryRef,
  replaceObjectsById,
  hoverSegmentIndexRef,
  hoverVertexIndexRef,
  dragVertexIndexRef,
  previewVerticesRef,
  hoverObjectIdRef,
  dragObjectIdRef,
  previewObjectGeometryRef,
  objectDragStartRef,
  objectDragGeometryRef,
  dragMovedRef,
  setHoverCoordinate,
  setHoverSegmentIndex,
  setHoverVertexIndex,
  setDragVertexIndex,
  setPreviewVertices,
  setHoverObjectId,
  setDragObjectId,
  setPreviewObjectGeometry,
  setGeometryEditMode,
  updateCanvasCursor,
  resetVertexEditing,
}: MapInteractionBindings) => {
  const clearHoveredSegment = () => {
    if (hoverSegmentIndexRef.current === null) {
      return;
    }

    hoverSegmentIndexRef.current = null;
    setHoverSegmentIndex(null);
  };

  const exitGeometryEditMode = () => {
    clearHoveredSegment();
    geometryEditModeRef.current = null;
    setGeometryEditMode(null);
    updateCanvasCursor();
  };

  const getSelectedEditableShape = () => {
    const object = selectedObjectRef.current;
    if (!object || isFreeDrawObject(object)) {
      return null;
    }

    const selectedLayer = projectLayersRef.current.find(
      (candidate) => candidate.id === selectedLayerIdRef.current,
    );
    if (selectedLayer?.locked) {
      return null;
    }

    return object.type === 'line' || object.type === 'polygon' ? object : null;
  };

  const getHoveredSegment = (event: MapMouseEvent) => {
    const object = getSelectedEditableShape();
    const vertices = getEditableVertices(object);
    if (!object || !vertices || vertices.length < 2) {
      return null;
    }

    const layers = object.type === 'polygon' ? ['polygon-line-hit'] : ['line-string-hit'];
    const interactiveFeatures = map.queryRenderedFeatures(event.point, { layers });
    const matchesSelectedObject = interactiveFeatures.some(
      (feature) => String(feature.properties?.objectId) === object.id,
    );

    if (!matchesSelectedObject) {
      return null;
    }

    return findNearestSegment(
      vertices,
      { x: event.point.x, y: event.point.y },
      (coordinate) => {
        const projected = map.project({ lng: coordinate[0], lat: coordinate[1] });
        return { x: projected.x, y: projected.y };
      },
      object.type === 'polygon',
    );
  };

  const handleObjectMouseEnter = (event: MapLayerMouseEvent) => {
    if (
      currentToolRef.current !== 'move' ||
      geometryEditModeRef.current !== null ||
      dragVertexIndexRef.current !== null ||
      dragObjectIdRef.current !== null
    ) {
      return;
    }

    const feature = event.features?.[0];
    if (!isFeatureSelectable(feature) || isFeatureLocked(feature)) {
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
      geometryEditModeRef.current !== null ||
      dragVertexIndexRef.current !== null ||
      hoverVertexIndexRef.current !== null
    ) {
      return;
    }

    const feature = event.features?.[0];
    if (!isFeatureSelectable(feature) || isFeatureLocked(feature)) {
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
    if (isFeatureLocked(feature)) {
      return;
    }

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
    const object = selectedObjectRef.current;
    const selectedLayer = projectLayersRef.current.find(
      (candidate) => candidate.id === selectedLayerIdRef.current,
    );
    const baseVertices = getEditableVertices(object);
    if (Number.isNaN(nextIndex) || !baseVertices || !object || selectedLayer?.locked) {
      return;
    }

    if (geometryEditModeRef.current === 'deleteVertex') {
      event.preventDefault();
      const result = deleteVertexFromObject(object, nextIndex);
      resetVertexEditing();

      if (!result) {
        return;
      }

      if (result.kind === 'delete') {
        replaceObjectsById([{ objectId: object.id, objects: [] }]);
      } else {
        updateSelectedObjectGeometryRef.current(result.geometry);
      }

      exitGeometryEditMode();
      return;
    }

    if (geometryEditModeRef.current !== null) {
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
    if (currentToolRef.current !== 'move') {
      return false;
    }

    if (geometryEditModeRef.current === 'insertVertex') {
      const object = getSelectedEditableShape();
      const hoveredSegment = object ? getHoveredSegment(event) : null;

      if (object && hoveredSegment) {
        const nextGeometry = insertVertexIntoObject(object, hoveredSegment.segmentIndex, [
          event.lngLat.lng,
          event.lngLat.lat,
        ]);

        if (nextGeometry) {
          updateSelectedObjectGeometryRef.current(nextGeometry);
          exitGeometryEditMode();
        }
      }

      return true;
    }

    if (geometryEditModeRef.current === 'deleteVertex') {
      return true;
    }

    const interactiveFeatures = map.queryRenderedFeatures(event.point, {
      layers: [...OBJECT_INTERACTIVE_LAYER_IDS],
    });

    const selectableFeature = interactiveFeatures.find(isFeatureSelectable);
    if (selectableFeature && !isFeatureLocked(selectableFeature)) {
      selectObjectRef.current(
        String(selectableFeature.properties.objectId),
        String(selectableFeature.properties.layerId),
      );
    } else {
      selectObjectRef.current(null, selectedLayerIdRef.current);
    }

    return true;
  };

  const handleMouseMove = (event: MapMouseEvent) => {
    if (currentToolRef.current === 'move' && geometryEditModeRef.current === 'insertVertex') {
      const hoveredSegment = getHoveredSegment(event);
      const nextIndex = hoveredSegment?.segmentIndex ?? null;

      if (hoverSegmentIndexRef.current !== nextIndex) {
        hoverSegmentIndexRef.current = nextIndex;
        setHoverSegmentIndex(nextIndex);
        updateCanvasCursor();
      }
    } else if (hoverSegmentIndexRef.current !== null) {
      clearHoveredSegment();
      updateCanvasCursor();
    }

    const activeVertexIndex = dragVertexIndexRef.current;
    if (activeVertexIndex !== null) {
      const baseVertices = previewVerticesRef.current ?? getEditableVertices(selectedObjectRef.current);
      if (!baseVertices) {
        return true;
      }

      dragMovedRef.current = true;
      const nextVertices = baseVertices.map((coordinate, index) =>
        index === activeVertexIndex ? ([event.lngLat.lng, event.lngLat.lat] as Position) : coordinate,
      );
      previewVerticesRef.current = nextVertices;
      setPreviewVertices(nextVertices);
      return true;
    }

    const activeObjectId = dragObjectIdRef.current;
    const dragOrigin = objectDragStartRef.current;
    const baseGeometry = objectDragGeometryRef.current;
    if (activeObjectId && dragOrigin && baseGeometry) {
      const deltaLng = event.lngLat.lng - dragOrigin[0];
      const deltaLat = event.lngLat.lat - dragOrigin[1];
      const nextGeometry = translateGeometry(baseGeometry, deltaLng, deltaLat);
      if (!nextGeometry) {
        return true;
      }

      dragMovedRef.current = true;
      previewObjectGeometryRef.current = nextGeometry;
      setPreviewObjectGeometry(nextGeometry);
      return true;
    }

    return false;
  };

  const handleMouseUp = () => {
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
      return true;
    }

    const activeObjectId = dragObjectIdRef.current;
    if (activeObjectId) {
      const draggedObjectGeometry = dragMovedRef.current ? previewObjectGeometryRef.current : null;
      resetVertexEditing();
      if (draggedObjectGeometry) {
        updateSelectedObjectGeometryRef.current(draggedObjectGeometry);
      }
      return true;
    }

    return false;
  };

  const handleMouseOut = () => {
    clearHoveredSegment();
    if (dragVertexIndexRef.current === null) {
      setHoverCoordinate(null);
    }
  };

  return {
    handleObjectMouseEnter,
    handleObjectMouseLeave,
    handleObjectMouseDown,
    handleVertexMouseEnter,
    handleVertexMouseLeave,
    handleVertexMouseDown,
    handleMapClick,
    handleMouseMove,
    handleMouseUp,
    handleMouseOut,
  };
};
