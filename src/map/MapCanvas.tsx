import 'maplibre-gl/dist/maplibre-gl.css';

import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { MapGeoJSONFeature, MapLayerMouseEvent, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useShallow } from 'zustand/react/shallow';

import {
  buildGeometryFromVertices,
  createLineObject,
  createPointObject,
  createPolygonObject,
  draftLineToFeatureCollection,
  draftPolygonToFeatureCollection,
  getEditableVertices,
  projectToFeatureCollection,
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

const OBJECTS_SOURCE_ID = 'objects';
const DRAFT_SOURCE_ID = 'draft';
const EDIT_SOURCE_ID = 'edit-vertices';
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
}: {
  tool: ToolId;
  isMapDragging: boolean;
  isVertexHovering: boolean;
  isVertexDragging: boolean;
}) => {
  if (isMapDragging || isVertexDragging) {
    return 'grabbing';
  }

  if (isVertexHovering && tool === 'move') {
    return 'grab';
  }

  if (tool === 'point') {
    return 'cell';
  }

  if (tool === 'line' || tool === 'polygon') {
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
    if (currentTool !== 'move') {
      return [];
    }

    return previewVertices ?? getEditableVertices(selectedObject) ?? [];
  }, [currentTool, previewVertices, selectedObject]);

  const previewGeometry = useMemo(() => {
    if (!selectedObject || !previewVertices) {
      return null;
    }

    return buildGeometryFromVertices(selectedObject.type, previewVertices);
  }, [previewVertices, selectedObject]);

  const objectsGeoJson = useMemo(
    () =>
      projectToFeatureCollection(
        project.layers,
        selectedObjectId,
        previewGeometry && selectedObjectId ? { [selectedObjectId]: previewGeometry } : {},
      ),
    [previewGeometry, project.layers, selectedObjectId],
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

  const draftGeoJson = useMemo(() => {
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
  }, [closeToStart, currentTool, draftCoordinates, hoverCoordinate]);

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
  const closeToStartRef = useRef(closeToStart);
  const mapDraggingRef = useRef(false);
  const suppressNextMapClickRef = useRef(false);

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
    closeToStartRef.current = closeToStart;
  }, [
    closeToStart,
    currentTool,
    draftCoordinates,
    draftGeoJson,
    dragVertexIndex,
    editGeoJson,
    hoverVertexIndex,
    onMapReady,
    objectsGeoJson,
    previewVertices,
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
      });
    };

    const resetVertexEditing = () => {
      dragVertexIndexRef.current = null;
      hoverVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      setDragVertexIndex(null);
      setHoverVertexIndex(null);
      setPreviewVertices(null);
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
        id: 'polygon-line',
        type: 'line',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#ffd166',
            ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 1],
            ['coalesce', ['get', 'strokeWidth'], 2],
          ],
        },
      });

      map.addLayer({
        id: 'line-string',
        type: 'line',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#ffd166',
            ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            ['+', ['coalesce', ['get', 'strokeWidth'], 2], 1],
            ['coalesce', ['get', 'strokeWidth'], 2],
          ],
          'line-opacity': ['coalesce', ['get', 'opacity'], 1],
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
            ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          ],
          'circle-opacity': ['coalesce', ['get', 'opacity'], 1],
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

    const handleObjectSelection = (event: MapLayerMouseEvent) => {
      if (currentToolRef.current !== 'move') {
        return;
      }

      const feature = event.features?.[0];
      if (isFeatureSelectable(feature)) {
        suppressNextMapClickRef.current = true;
        selectObjectRef.current(String(feature.properties.objectId), String(feature.properties.layerId));
      }
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
      suppressNextMapClickRef.current = true;
      dragVertexIndexRef.current = nextIndex;
      hoverVertexIndexRef.current = nextIndex;
      previewVerticesRef.current = baseVertices;
      setDragVertexIndex(nextIndex);
      setHoverVertexIndex(nextIndex);
      setPreviewVertices(baseVertices);
      map.dragPan.disable();
      updateCanvasCursor();
    };

    const handleMapClick = (event: MapMouseEvent) => {
      if (suppressNextMapClickRef.current) {
        suppressNextMapClickRef.current = false;
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

        const nextVertices = baseVertices.map((coordinate, index) =>
          index === activeVertexIndex ? ([event.lngLat.lng, event.lngLat.lat] as Position) : coordinate,
        );
        previewVerticesRef.current = nextVertices;
        setPreviewVertices(nextVertices);
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
      const activeVertexIndex = dragVertexIndexRef.current;
      const vertices = previewVerticesRef.current;
      const object = selectedObjectRef.current;
      if (activeVertexIndex === null || !vertices || !object) {
        return;
      }

      const nextGeometry = buildGeometryFromVertices(object.type, vertices);
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

    const handleEmptySelection = () => {
      if (suppressNextMapClickRef.current) {
        suppressNextMapClickRef.current = false;
        return;
      }

      if (currentToolRef.current === 'move' && dragVertexIndexRef.current === null) {
        selectObjectRef.current(null, selectedLayerIdRef.current);
      }
    };

    map.on('click', 'polygon-fill', handleObjectSelection);
    map.on('click', 'polygon-line', handleObjectSelection);
    map.on('click', 'line-string', handleObjectSelection);
    map.on('click', 'points', handleObjectSelection);
    map.on('mouseenter', 'edit-vertex-hit', handleVertexMouseEnter);
    map.on('mouseleave', 'edit-vertex-hit', handleVertexMouseLeave);
    map.on('mousedown', 'edit-vertex-hit', handleVertexMouseDown);
    map.on('click', handleMapClick);
    map.on('dblclick', handleDoubleClick);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.on('mouseout', handleMouseOut);
    map.on('click', handleEmptySelection);

    onMapReadyRef.current(map);
    mapRef.current = map;
    updateCanvasCursor();

    return () => {
      map.off('click', 'polygon-fill', handleObjectSelection);
      map.off('click', 'polygon-line', handleObjectSelection);
      map.off('click', 'line-string', handleObjectSelection);
      map.off('click', 'points', handleObjectSelection);
      map.off('mouseenter', 'edit-vertex-hit', handleVertexMouseEnter);
      map.off('mouseleave', 'edit-vertex-hit', handleVertexMouseLeave);
      map.off('mousedown', 'edit-vertex-hit', handleVertexMouseDown);
      map.off('click', handleMapClick);
      map.off('dblclick', handleDoubleClick);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('mouseout', handleMouseOut);
      map.off('click', handleEmptySelection);
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
      setHoverVertexIndex(null);
      setDragVertexIndex(null);
      setPreviewVertices(null);
      if (!map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
    }
  }, [currentTool, dragVertexIndex, hoverVertexIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (currentTool !== 'move' || selectedObject?.type === 'point') {
      hoverVertexIndexRef.current = null;
      dragVertexIndexRef.current = null;
      previewVerticesRef.current = null;
      setHoverVertexIndex(null);
      setDragVertexIndex(null);
      setPreviewVertices(null);
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
    <div className="relative h-full w-full overflow-hidden rounded-md border border-border bg-panelAlt shadow-panel">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
      />
      {currentTool === 'polygon' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-panel">
          Click to add vertices. Double-click or click the first point to finish.
        </div>
      )}
      {currentTool === 'line' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white shadow-panel">
          Click to add points. Double-click to finish the line.
        </div>
      )}
    </div>
  );
}
