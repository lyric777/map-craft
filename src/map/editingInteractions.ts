import type { Position } from 'geojson';
import type { MapGeoJSONFeature, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';

import {
  buildGeometryFromVertices,
  getEditableVertices,
  translateGeometry,
} from '../lib/project';
import { OBJECT_INTERACTIVE_LAYER_IDS } from './constants';
import type { MapInteractionBindings } from './interactionBindings';

const isFeatureSelectable = (feature: MapGeoJSONFeature | undefined): feature is MapGeoJSONFeature =>
  Boolean(feature?.properties?.objectId);

export const createEditingHandlers = ({
  map,
  currentToolRef,
  selectedLayerIdRef,
  selectedObjectRef,
  selectObjectRef,
  updateSelectedObjectGeometryRef,
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
  setHoverVertexIndex,
  setDragVertexIndex,
  setPreviewVertices,
  setHoverObjectId,
  setDragObjectId,
  setPreviewObjectGeometry,
  updateCanvasCursor,
  resetVertexEditing,
}: MapInteractionBindings) => {
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
    if (currentToolRef.current !== 'move') {
      return false;
    }

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

    return true;
  };

  const handleMouseMove = (event: MapMouseEvent) => {
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
