import 'maplibre-gl/dist/maplibre-gl.css';

import type { Geometry, Position } from 'geojson';
import type { MapcraftObject } from '../types/project';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useShallow } from 'zustand/react/shallow';

import {
  buildGeometryFromVertices,
  draftLineToFeatureCollection,
  draftPolygonToFeatureCollection,
  freeDrawToFeatureCollection,
  getEditableVertices,
  getSourceObjectId,
  projectToFeatureCollection,
  vertexHandlesToFeatureCollection,
} from '../lib/project';
import { getCursorForState } from './cursor';
import {
  BASEMAP_STYLE,
  DRAFT_SOURCE_ID,
  EDIT_SOURCE_ID,
  EMPTY_GEOJSON,
  OBJECTS_SOURCE_ID,
} from './constants';
import { bindMapInteractions } from './interactions';
import { registerEditorLayers } from './layers';
import { selectActiveObject, useEditorStore } from '../state/editorStore';
import type { GeometryEditMode, ScreenPoint } from './types';

interface MapCanvasProps {
  geometryEditMode: GeometryEditMode | null;
  mapToastMessage?: string | null;
  onMapReady: (map: maplibregl.Map) => void;
  onGeometryEditModeChange: (mode: GeometryEditMode | null) => void;
}

const instructionClassName =
  'pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-[0_4px_10px_rgba(15,23,42,0.18)]';

export function MapCanvas({
  geometryEditMode,
  mapToastMessage = null,
  onMapReady,
  onGeometryEditModeChange,
}: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<Position[]>([]);
  const [hoverCoordinate, setHoverCoordinate] = useState<Position | null>(null);
  const [hoverSegmentIndex, setHoverSegmentIndex] = useState<number | null>(null);
  const [hoverVertexIndex, setHoverVertexIndex] = useState<number | null>(null);
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);
  const [previewVertices, setPreviewVertices] = useState<Position[] | null>(null);
  const [hoverObjectId, setHoverObjectId] = useState<string | null>(null);
  const [dragObjectId, setDragObjectId] = useState<string | null>(null);
  const [previewObjectGeometry, setPreviewObjectGeometry] = useState<Geometry | null>(null);
  const [freeDrawScreenPoints, setFreeDrawScreenPoints] = useState<ScreenPoint[]>([]);
  const [isFreeDrawing, setIsFreeDrawing] = useState(false);
  const [eraserPreviewReplacements, setEraserPreviewReplacements] = useState<
    Array<{ objectId: string; objects: MapcraftObject[] }>
  >([]);
  const {
    currentTool,
    project,
    selectedLayerId,
    selectedObjectId,
    setViewport,
    addObjectToSelectedLayer,
    replaceObjectsById,
    selectObject,
    updateSelectedObjectGeometry,
  } = useEditorStore(
    useShallow((state) => ({
      currentTool: state.currentTool,
      project: state.project,
      selectedLayerId: state.selectedLayerId,
      selectedObjectId: state.selectedObjectId,
      setViewport: state.setViewport,
      addObjectToSelectedLayer: state.addObjectToSelectedLayer,
      replaceObjectsById: state.replaceObjectsById,
      selectObject: state.selectObject,
      updateSelectedObjectGeometry: state.updateSelectedObjectGeometry,
    })),
  );
  const selectedObject = useMemo(
    () => selectActiveObject(project.layers, selectedLayerId, selectedObjectId),
    [project.layers, selectedLayerId, selectedObjectId],
  );

  const selectedEditableVertices = useMemo(() => {
    if (currentTool !== 'move' || dragObjectId !== null) {
      return [];
    }

    return previewVertices ?? getEditableVertices(selectedObject) ?? [];
  }, [currentTool, dragObjectId, previewVertices, selectedObject]);

  const previewGeometry = useMemo(() => {
    if (!selectedObject || !previewVertices) {
      return null;
    }

    return buildGeometryFromVertices(selectedObject.type, previewVertices);
  }, [previewVertices, selectedObject]);

  const geometryOverrides = useMemo(() => {
    const nextOverrides: Record<string, Geometry> = {};

    if (previewGeometry && selectedObjectId) {
      nextOverrides[selectedObjectId] = previewGeometry;
    }

    if (previewObjectGeometry && dragObjectId) {
      nextOverrides[dragObjectId] = previewObjectGeometry;
    }

    return nextOverrides;
  }, [dragObjectId, previewGeometry, previewObjectGeometry, selectedObjectId]);

  const objectsGeoJson = useMemo(
    () => {
      const replacementMap = new Map(
        eraserPreviewReplacements.map((entry) => [entry.objectId, entry.objects] as const),
      );

      const previewLayers = project.layers.map((layer) => {
        const consumedSourceIds = new Set<string>();

        return {
          ...layer,
          objects: layer.objects.flatMap((object) => {
            const sourceObjectId = getSourceObjectId(object);
            const replacementObjects = replacementMap.get(sourceObjectId) ?? replacementMap.get(object.id);

            if (!replacementObjects) {
              return [object];
            }

            if (consumedSourceIds.has(sourceObjectId)) {
              return [];
            }

            consumedSourceIds.add(sourceObjectId);
            return replacementObjects;
          }),
        };
      });

      return projectToFeatureCollection(previewLayers, selectedObjectId, hoverObjectId, geometryOverrides);
    },
    [eraserPreviewReplacements, geometryOverrides, hoverObjectId, project.layers, selectedObjectId],
  );

  const closeToStart = useMemo(() => {
    if (currentTool !== 'polygon' || !hoverCoordinate || draftCoordinates.length < 3 || !mapRef.current) {
      return false;
    }

    const first = draftCoordinates[0];
    const map = mapRef.current;
    const firstPoint = map.project({ lng: first[0], lat: first[1] });
    const hoverPoint = map.project({ lng: hoverCoordinate[0], lat: hoverCoordinate[1] });
    return Math.hypot(firstPoint.x - hoverPoint.x, firstPoint.y - hoverPoint.y) < 12;
  }, [currentTool, draftCoordinates, hoverCoordinate]);

  const freeDrawCoordinates = useMemo(() => {
    const map = mapRef.current;
    if (!map) {
      return [];
    }

    return freeDrawScreenPoints.map(({ x, y }) => {
      const coordinate = map.unproject([x, y]);
      return [coordinate.lng, coordinate.lat] as Position;
    });
  }, [freeDrawScreenPoints]);

  const draftGeoJson = useMemo(() => {
    if (currentTool === 'freeDraw') {
      return freeDrawToFeatureCollection(freeDrawCoordinates);
    }

    if (currentTool === 'line') {
      return draftLineToFeatureCollection(
        draftCoordinates as number[][],
        hoverCoordinate as number[] | null,
      );
    }

    if (currentTool === 'polygon') {
      return draftPolygonToFeatureCollection(
        draftCoordinates as number[][],
        hoverCoordinate as number[] | null,
        closeToStart,
      );
    }

    return EMPTY_GEOJSON;
  }, [closeToStart, currentTool, draftCoordinates, freeDrawCoordinates, hoverCoordinate]);

  const editGeoJson = useMemo(
    () => vertexHandlesToFeatureCollection(selectedEditableVertices, hoverVertexIndex, dragVertexIndex),
    [dragVertexIndex, hoverVertexIndex, selectedEditableVertices],
  );

  const currentToolRef = useRef(currentTool);
  const geometryEditModeRef = useRef<GeometryEditMode | null>(geometryEditMode);
  const onMapReadyRef = useRef(onMapReady);
  const onGeometryEditModeChangeRef = useRef(onGeometryEditModeChange);
  const projectLayersRef = useRef(project.layers);
  const selectObjectRef = useRef(selectObject);
  const setViewportRef = useRef(setViewport);
  const updateSelectedObjectGeometryRef = useRef(updateSelectedObjectGeometry);
  const objectsGeoJsonRef = useRef(objectsGeoJson);
  const draftGeoJsonRef = useRef(draftGeoJson);
  const editGeoJsonRef = useRef(editGeoJson);
  const initialViewportRef = useRef(project.viewport);
  const draftCoordinatesRef = useRef<Position[]>(draftCoordinates);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const selectedObjectRef = useRef(selectedObject);
  const hoverSegmentIndexRef = useRef<number | null>(hoverSegmentIndex);
  const hoverVertexIndexRef = useRef<number | null>(hoverVertexIndex);
  const dragVertexIndexRef = useRef<number | null>(dragVertexIndex);
  const previewVerticesRef = useRef<Position[] | null>(previewVertices);
  const hoverObjectIdRef = useRef<string | null>(hoverObjectId);
  const dragObjectIdRef = useRef<string | null>(dragObjectId);
  const previewObjectGeometryRef = useRef<Geometry | null>(previewObjectGeometry);
  const objectDragStartRef = useRef<Position | null>(null);
  const objectDragGeometryRef = useRef<Geometry | null>(null);
  const dragMovedRef = useRef(false);
  const freeDrawScreenPointsRef = useRef<ScreenPoint[]>(freeDrawScreenPoints);
  const isFreeDrawingRef = useRef(isFreeDrawing);
  const isErasingRef = useRef(false);
  const eraserPreviewReplacementsRef = useRef(eraserPreviewReplacements);
  const closeToStartRef = useRef(closeToStart);
  const mapDraggingRef = useRef(false);

  useEffect(() => {
    currentToolRef.current = currentTool;
    geometryEditModeRef.current = geometryEditMode;
    onMapReadyRef.current = onMapReady;
    onGeometryEditModeChangeRef.current = onGeometryEditModeChange;
    projectLayersRef.current = project.layers;
    selectObjectRef.current = selectObject;
    setViewportRef.current = setViewport;
    updateSelectedObjectGeometryRef.current = updateSelectedObjectGeometry;
    objectsGeoJsonRef.current = objectsGeoJson;
    draftGeoJsonRef.current = draftGeoJson;
    editGeoJsonRef.current = editGeoJson;
    draftCoordinatesRef.current = draftCoordinates;
    selectedLayerIdRef.current = selectedLayerId;
    selectedObjectRef.current = selectedObject;
    hoverSegmentIndexRef.current = hoverSegmentIndex;
    hoverVertexIndexRef.current = hoverVertexIndex;
    dragVertexIndexRef.current = dragVertexIndex;
    previewVerticesRef.current = previewVertices;
    hoverObjectIdRef.current = hoverObjectId;
    dragObjectIdRef.current = dragObjectId;
    previewObjectGeometryRef.current = previewObjectGeometry;
    freeDrawScreenPointsRef.current = freeDrawScreenPoints;
    isFreeDrawingRef.current = isFreeDrawing;
    eraserPreviewReplacementsRef.current = eraserPreviewReplacements;
    closeToStartRef.current = closeToStart;
  }, [
    closeToStart,
    currentTool,
    draftCoordinates,
    draftGeoJson,
    dragObjectId,
    dragVertexIndex,
    eraserPreviewReplacements,
    editGeoJson,
    geometryEditMode,
    hoverObjectId,
    hoverSegmentIndex,
    hoverVertexIndex,
    isFreeDrawing,
    onGeometryEditModeChange,
    onMapReady,
    project.layers,
    objectsGeoJson,
    previewObjectGeometry,
    previewVertices,
    freeDrawScreenPoints,
    selectObject,
    selectedLayerId,
    selectedObject,
    setViewport,
    updateSelectedObjectGeometry,
  ]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const initialViewport = initialViewportRef.current;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLE,
      center: initialViewport.center as [number, number],
      zoom: initialViewport.zoom,
      attributionControl: false,
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
      },
    });

    const updateCanvasCursor = () => {
      map.getCanvasContainer().style.cursor = getCursorForState({
        tool: currentToolRef.current,
        geometryEditMode: geometryEditModeRef.current,
        isMapDragging: mapDraggingRef.current,
        isSegmentHovering: hoverSegmentIndexRef.current !== null,
        isVertexHovering: hoverVertexIndexRef.current !== null,
        isVertexDragging: dragVertexIndexRef.current !== null,
        isObjectHovering: hoverObjectIdRef.current !== null,
        isObjectDragging: dragObjectIdRef.current !== null,
      });
    };

    const resetVertexEditing = () => {
      hoverSegmentIndexRef.current = null;
      dragVertexIndexRef.current = null;
      hoverVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      dragObjectIdRef.current = null;
      hoverObjectIdRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
      dragMovedRef.current = false;
      setHoverSegmentIndex(null);
      setDragVertexIndex(null);
      setHoverVertexIndex(null);
      setPreviewVertices(null);
      setDragObjectId(null);
      setHoverObjectId(null);
      setPreviewObjectGeometry(null);
      if (!map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
      updateCanvasCursor();
    };

    const resetFreeDraw = () => {
      freeDrawScreenPointsRef.current = [];
      isFreeDrawingRef.current = false;
      setFreeDrawScreenPoints([]);
      setIsFreeDrawing(false);
      if (!map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
      updateCanvasCursor();
    };

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource(OBJECTS_SOURCE_ID, {
        type: 'geojson',
        data: objectsGeoJsonRef.current,
      });

      map.addSource(DRAFT_SOURCE_ID, {
        type: 'geojson',
        data: draftGeoJsonRef.current,
      });

      map.addSource(EDIT_SOURCE_ID, {
        type: 'geojson',
        data: editGeoJsonRef.current,
      });
      registerEditorLayers(map);
    });

    map.on('moveend', () => {
      mapDraggingRef.current = false;
      updateCanvasCursor();
      const center = map.getCenter();
      setViewportRef.current({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      });
    });

    map.on('dragstart', () => {
      mapDraggingRef.current = true;
      updateCanvasCursor();
    });

    map.on('dragend', () => {
      mapDraggingRef.current = false;
      updateCanvasCursor();
    });

    const detachInteractions = bindMapInteractions({
      map,
      currentToolRef,
      projectLayersRef,
      selectedLayerIdRef,
      selectedObjectRef,
      geometryEditModeRef,
      selectObjectRef,
      updateSelectedObjectGeometryRef,
      addObjectToSelectedLayer,
      replaceObjectsById,
      draftCoordinatesRef,
      closeToStartRef,
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
      freeDrawScreenPointsRef,
      isFreeDrawingRef,
      isErasingRef,
      eraserPreviewReplacementsRef,
      setDraftCoordinates,
      setHoverCoordinate,
      setHoverSegmentIndex,
      setHoverVertexIndex,
      setDragVertexIndex,
      setPreviewVertices,
      setHoverObjectId,
      setDragObjectId,
      setPreviewObjectGeometry,
	      setFreeDrawScreenPoints,
	      setIsFreeDrawing,
	      setEraserPreviewReplacements,
	      setGeometryEditMode: (mode) => onGeometryEditModeChangeRef.current(mode),
	      updateCanvasCursor,
	      resetVertexEditing,
	      resetFreeDraw,
	    });

    onMapReadyRef.current(map);
    mapRef.current = map;
    updateCanvasCursor();

    return () => {
      detachInteractions();
      map.getCanvasContainer().style.cursor = '';
      map.remove();
      mapRef.current = null;
    };
  }, [addObjectToSelectedLayer, replaceObjectsById]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(OBJECTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(objectsGeoJson);
    }
  }, [objectsGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(DRAFT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(draftGeoJson);
    }
  }, [draftGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(EDIT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(editGeoJson);
    }
  }, [editGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.getCanvasContainer().style.cursor = getCursorForState({
      tool: currentTool,
      geometryEditMode,
      isMapDragging: mapDraggingRef.current,
      isSegmentHovering: hoverSegmentIndex !== null,
      isVertexHovering: hoverVertexIndex !== null,
      isVertexDragging: dragVertexIndex !== null,
      isObjectHovering: hoverObjectId !== null,
      isObjectDragging: dragObjectId !== null,
    });

    if (currentTool === 'polygon' || currentTool === 'line') {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
      draftCoordinatesRef.current = [];
      setDraftCoordinates([]);
      setHoverCoordinate(null);
    }

    if (currentTool !== 'move') {
      hoverSegmentIndexRef.current = null;
      hoverVertexIndexRef.current = null;
      dragVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      hoverObjectIdRef.current = null;
      dragObjectIdRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
      setHoverSegmentIndex(null);
      setHoverVertexIndex(null);
      setDragVertexIndex(null);
      setPreviewVertices(null);
      setHoverObjectId(null);
      setDragObjectId(null);
      setPreviewObjectGeometry(null);
      if (!map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
    }

    if (currentTool !== 'freeDraw') {
      freeDrawScreenPointsRef.current = [];
      isFreeDrawingRef.current = false;
      setFreeDrawScreenPoints([]);
      setIsFreeDrawing(false);
      if (!map.dragPan.isEnabled() && dragVertexIndex === null && dragObjectId === null) {
        map.dragPan.enable();
      }
    }

    if (currentTool !== 'eraser') {
      isErasingRef.current = false;
      eraserPreviewReplacementsRef.current = [];
      setEraserPreviewReplacements([]);
      if (!map.dragPan.isEnabled() && dragVertexIndex === null && dragObjectId === null) {
        map.dragPan.enable();
      }
    }
  }, [
    currentTool,
    dragObjectId,
    dragVertexIndex,
    geometryEditMode,
    hoverObjectId,
    hoverSegmentIndex,
    hoverVertexIndex,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (currentTool !== 'move') {
      hoverSegmentIndexRef.current = null;
      hoverVertexIndexRef.current = null;
      dragVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      hoverObjectIdRef.current = null;
      dragObjectIdRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
      setHoverSegmentIndex(null);
      setHoverVertexIndex(null);
      setDragVertexIndex(null);
      setPreviewVertices(null);
      setHoverObjectId(null);
      setDragObjectId(null);
      setPreviewObjectGeometry(null);
      if (!map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
      onGeometryEditModeChange(null);
    }
  }, [currentTool, onGeometryEditModeChange, selectedObject?.id, selectedObject?.type]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const { center, zoom } = project.viewport;
    const mapCenter = map.getCenter();
    const centerChanged = mapCenter.lng !== center[0] || mapCenter.lat !== center[1];
    const zoomChanged = map.getZoom() !== zoom;

    if (!centerChanged && !zoomChanged) {
      return;
    }

    map.jumpTo({ center: center as [number, number], zoom });
  }, [project.viewport]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-border bg-panelAlt">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
      />
      {currentTool === 'move' && geometryEditMode === 'insertVertex' && (
        <div className={instructionClassName}>Click an edge to add a vertex.</div>
      )}
      {currentTool === 'move' && geometryEditMode === 'deleteVertex' && (
        <div className={instructionClassName}>Click a vertex to remove it.</div>
      )}
      {currentTool === 'polygon' && (
        <div className={instructionClassName}>
          Click to add vertices. Double-click or click the first point to finish.
        </div>
      )}
      {currentTool === 'line' && (
        <div className={instructionClassName}>
          Click to add points. Double-click to finish the line.
        </div>
      )}
      {currentTool === 'freeDraw' && (
        <div className={instructionClassName}>
          Drag to sketch a freehand line.
        </div>
      )}
      {currentTool === 'eraser' && (
        <div className={instructionClassName}>
          Drag across free draw strokes to erase them.
        </div>
      )}
      {mapToastMessage && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-[0_4px_10px_rgba(15,23,42,0.18)]">
          {mapToastMessage}
        </div>
      )}
    </div>
  );
}
