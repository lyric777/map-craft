import 'maplibre-gl/dist/maplibre-gl.css';

import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { MapGeoJSONFeature, MapLayerMouseEvent, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useShallow } from 'zustand/react/shallow';

import {
  buildGeometryFromVertices,
  createFreeDrawObject,
  createLineObject,
  createPointObject,
  createPolygonObject,
  draftLineToFeatureCollection,
  draftPolygonToFeatureCollection,
  freeDrawToFeatureCollection,
  getEditableVertices,
  projectToFeatureCollection,
  translateGeometry,
  vertexHandlesToFeatureCollection,
} from '../lib/project';
import { selectActiveObject, useEditorStore } from '../state/editorStore';
import type { ToolId } from '../types/project';

const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

interface MapCanvasProps {
  onMapReady: (map: maplibregl.Map) => void;
}

interface ScreenPoint {
  x: number;
  y: number;
}

const OBJECTS_SOURCE_ID = 'objects';
const DRAFT_SOURCE_ID = 'draft';
const EDIT_SOURCE_ID = 'edit-vertices';
const OBJECT_INTERACTIVE_LAYER_IDS = [
  'polygon-fill-hit',
  'polygon-line-hit',
  'line-string-hit',
  'points-hit',
  'polygon-fill',
  'polygon-line',
  'line-string',
  'points',
] as const;
const FREE_DRAW_POINT_THRESHOLD = 4;
const EMPTY_GEOJSON: FeatureCollection<Geometry> = {
  type: 'FeatureCollection',
  features: [],
};

const isFeatureSelectable = (feature: MapGeoJSONFeature | undefined): feature is MapGeoJSONFeature =>
  Boolean(feature?.properties?.objectId);

const getCursorForState = ({
  tool,
  isMapDragging,
  isVertexHovering,
  isVertexDragging,
  isObjectHovering,
  isObjectDragging,
}: {
  tool: ToolId;
  isMapDragging: boolean;
  isVertexHovering: boolean;
  isVertexDragging: boolean;
  isObjectHovering: boolean;
  isObjectDragging: boolean;
}) => {
  if (isMapDragging || isVertexDragging || isObjectDragging) {
    return 'grabbing';
  }

  if (isVertexHovering && tool === 'move') {
    return 'grab';
  }

  if (isObjectHovering && tool === 'move') {
    return 'grab';
  }

  if (tool === 'point') {
    return 'cell';
  }

  if (tool === 'line' || tool === 'polygon' || tool === 'freeDraw') {
    return 'crosshair';
  }

  return 'default';
};

export function MapCanvas({ onMapReady }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<Position[]>([]);
  const [hoverCoordinate, setHoverCoordinate] = useState<Position | null>(null);
  const [hoverVertexIndex, setHoverVertexIndex] = useState<number | null>(null);
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);
  const [previewVertices, setPreviewVertices] = useState<Position[] | null>(null);
  const [hoverObjectId, setHoverObjectId] = useState<string | null>(null);
  const [dragObjectId, setDragObjectId] = useState<string | null>(null);
  const [previewObjectGeometry, setPreviewObjectGeometry] = useState<Geometry | null>(null);
  const [freeDrawScreenPoints, setFreeDrawScreenPoints] = useState<ScreenPoint[]>([]);
  const [isFreeDrawing, setIsFreeDrawing] = useState(false);
  const {
    currentTool,
    project,
    selectedLayerId,
    selectedObjectId,
    setViewport,
    addObjectToSelectedLayer,
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
    () => projectToFeatureCollection(project.layers, selectedObjectId, hoverObjectId, geometryOverrides),
    [geometryOverrides, hoverObjectId, project.layers, selectedObjectId],
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
  const onMapReadyRef = useRef(onMapReady);
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
  const closeToStartRef = useRef(closeToStart);
  const mapDraggingRef = useRef(false);

  useEffect(() => {
    currentToolRef.current = currentTool;
    onMapReadyRef.current = onMapReady;
    selectObjectRef.current = selectObject;
    setViewportRef.current = setViewport;
    updateSelectedObjectGeometryRef.current = updateSelectedObjectGeometry;
    objectsGeoJsonRef.current = objectsGeoJson;
    draftGeoJsonRef.current = draftGeoJson;
    editGeoJsonRef.current = editGeoJson;
    draftCoordinatesRef.current = draftCoordinates;
    selectedLayerIdRef.current = selectedLayerId;
    selectedObjectRef.current = selectedObject;
    hoverVertexIndexRef.current = hoverVertexIndex;
    dragVertexIndexRef.current = dragVertexIndex;
    previewVerticesRef.current = previewVertices;
    hoverObjectIdRef.current = hoverObjectId;
    dragObjectIdRef.current = dragObjectId;
    previewObjectGeometryRef.current = previewObjectGeometry;
    freeDrawScreenPointsRef.current = freeDrawScreenPoints;
    isFreeDrawingRef.current = isFreeDrawing;
    closeToStartRef.current = closeToStart;
  }, [
    closeToStart,
    currentTool,
    draftCoordinates,
    draftGeoJson,
    dragObjectId,
    dragVertexIndex,
    editGeoJson,
    hoverObjectId,
    hoverVertexIndex,
    isFreeDrawing,
    onMapReady,
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
        isMapDragging: mapDraggingRef.current,
        isVertexHovering: hoverVertexIndexRef.current !== null,
        isVertexDragging: dragVertexIndexRef.current !== null,
        isObjectHovering: hoverObjectIdRef.current !== null,
        isObjectDragging: dragObjectIdRef.current !== null,
      });
    };

    const resetVertexEditing = () => {
      dragVertexIndexRef.current = null;
      hoverVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      dragObjectIdRef.current = null;
      hoverObjectIdRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
      dragMovedRef.current = false;
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

      map.addLayer({
        id: 'polygon-fill',
        type: 'fill',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': ['coalesce', ['get', 'fillColor'], '#45c4ff'],
          'fill-opacity': ['coalesce', ['get', 'opacity'], 0.45],
        },
      });

      map.addLayer({
        id: 'polygon-fill-hit',
        type: 'fill',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0,
        },
      });

      map.addLayer({
        id: 'polygon-line',
        type: 'line',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#ffd166',
            ['boolean', ['get', 'isHovered'], false],
            '#7dd3fc',
            ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 1],
            ['boolean', ['get', 'isHovered'], false],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 0.75],
            ['coalesce', ['get', 'strokeWidth'], 2],
          ],
        },
      });

      map.addLayer({
        id: 'polygon-line-hit',
        type: 'line',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': '#000000',
          'line-width': ['+', ['coalesce', ['get', 'strokeWidth'], 2], 12],
          'line-opacity': 0,
        },
      });

      map.addLayer({
        id: 'line-string',
        type: 'line',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#ffd166',
            [
              'all',
              ['boolean', ['get', 'isHovered'], false],
              ['boolean', ['get', 'isFreeDraw'], false],
            ],
            '#38bdf8',
            ['boolean', ['get', 'isHovered'], false],
            '#7dd3fc',
            ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 1],
            [
              'all',
              ['boolean', ['get', 'isHovered'], false],
              ['boolean', ['get', 'isFreeDraw'], false],
            ],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 2.5],
            ['boolean', ['get', 'isHovered'], false],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 1.5],
            ['coalesce', ['get', 'strokeWidth'], 2],
          ],
          'line-opacity': ['coalesce', ['get', 'opacity'], 1],
        },
      });

      map.addLayer({
        id: 'line-string-hit',
        type: 'line',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#000000',
          'line-width': ['+', ['coalesce', ['get', 'strokeWidth'], 2], 14],
          'line-opacity': 0,
        },
      });

      map.addLayer({
        id: 'points',
        type: 'circle',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['boolean', ['get', 'isSelected'], false], 8, 6],
          'circle-color': ['coalesce', ['get', 'fillColor'], '#45c4ff'],
          'circle-stroke-width': ['case', ['boolean', ['get', 'isSelected'], false], 3, 2],
          'circle-stroke-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#ffd166',
            ['boolean', ['get', 'isHovered'], false],
            '#7dd3fc',
            ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          ],
          'circle-opacity': ['coalesce', ['get', 'opacity'], 1],
        },
      });

      map.addLayer({
        id: 'points-hit',
        type: 'circle',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 14,
          'circle-color': '#000000',
          'circle-opacity': 0,
        },
      });

      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: DRAFT_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'draftRole'], 'preview-fill']],
        paint: {
          'fill-color': '#45c4ff',
          'fill-opacity': 0.2,
        },
      });

      map.addLayer({
        id: 'draft-committed-line',
        type: 'line',
        source: DRAFT_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'draftRole'], 'committed-line']],
        paint: {
          'line-color': '#45c4ff',
          'line-width': 2,
        },
      });

      map.addLayer({
        id: 'draft-active-line',
        type: 'line',
        source: DRAFT_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'draftRole'], 'active-line']],
        paint: {
          'line-color': '#9be7ff',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      map.addLayer({
        id: 'draft-free-draw-line',
        type: 'line',
        source: DRAFT_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'draftRole'], 'free-draw-line']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#45c4ff',
          'line-width': 2.5,
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'draft-vertices',
        type: 'circle',
        source: DRAFT_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'draftRole'], 'vertex']],
        paint: {
          'circle-radius': 4,
          'circle-color': '#45c4ff',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'draft-start-vertex',
        type: 'circle',
        source: DRAFT_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'draftRole'], 'start-vertex']],
        paint: {
          'circle-radius': ['case', ['boolean', ['get', 'snapReady'], false], 7, 5],
          'circle-color': ['case', ['boolean', ['get', 'snapReady'], false], '#ffd166', '#45c4ff'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'edit-vertex-hit',
        type: 'circle',
        source: EDIT_SOURCE_ID,
        paint: {
          'circle-radius': 12,
          'circle-opacity': 0,
        },
      });

      map.addLayer({
        id: 'edit-vertices',
        type: 'circle',
        source: EDIT_SOURCE_ID,
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['get', 'isDragging'], false],
            8,
            ['boolean', ['get', 'isHover'], false],
            7,
            5,
          ],
          'circle-color': [
            'case',
            ['boolean', ['get', 'isDragging'], false],
            '#ffd166',
            ['boolean', ['get', 'isHover'], false],
            '#9be7ff',
            '#ffffff',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
        },
      });
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
      if (currentToolRef.current !== 'move' || dragVertexIndexRef.current !== null) {
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
      hoverObjectIdRef.current = null;
      previewVerticesRef.current = baseVertices;
      dragMovedRef.current = false;
      setDragVertexIndex(nextIndex);
      setHoverVertexIndex(nextIndex);
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

      const activeObjectId = dragObjectIdRef.current;
      if (activeObjectId) {
        const draggedObjectGeometry = dragMovedRef.current ? previewObjectGeometryRef.current : null;
        resetVertexEditing();
        if (draggedObjectGeometry) {
          updateSelectedObjectGeometryRef.current(draggedObjectGeometry);
        }
        return;
      }

      const activeVertexIndex = dragVertexIndexRef.current;
      const vertices = previewVerticesRef.current;
      const object = selectedObjectRef.current;
      if (activeVertexIndex === null) {
        return;
      }

      const nextGeometry =
        dragMovedRef.current && vertices && object
          ? buildGeometryFromVertices(object.type, vertices)
          : null;
      resetVertexEditing();

      if (nextGeometry) {
        updateSelectedObjectGeometryRef.current(nextGeometry);
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

    onMapReadyRef.current(map);
    mapRef.current = map;
    updateCanvasCursor();

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
      map.getCanvasContainer().style.cursor = '';
      map.remove();
      mapRef.current = null;
    };
  }, [addObjectToSelectedLayer]);

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
      isMapDragging: mapDraggingRef.current,
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
      hoverVertexIndexRef.current = null;
      dragVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      hoverObjectIdRef.current = null;
      dragObjectIdRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
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
  }, [currentTool, dragObjectId, dragVertexIndex, hoverObjectId, hoverVertexIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (currentTool !== 'move') {
      hoverVertexIndexRef.current = null;
      dragVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      hoverObjectIdRef.current = null;
      dragObjectIdRef.current = null;
      previewObjectGeometryRef.current = null;
      objectDragStartRef.current = null;
      objectDragGeometryRef.current = null;
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
  }, [currentTool, selectedObject?.id, selectedObject?.type]);

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
      {currentTool === 'polygon' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-[0_4px_10px_rgba(15,23,42,0.18)]">
          Click to add vertices. Double-click or click the first point to finish.
        </div>
      )}
      {currentTool === 'line' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-[0_4px_10px_rgba(15,23,42,0.18)]">
          Click to add points. Double-click to finish the line.
        </div>
      )}
      {currentTool === 'freeDraw' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-[0_4px_10px_rgba(15,23,42,0.18)]">
          Drag to sketch a freehand line.
        </div>
      )}
    </div>
  );
}
