import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import type { Position } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useShallow } from 'zustand/react/shallow';

import {
  createPolygonObject,
  draftPolygonToFeatureCollection,
  projectToFeatureCollection,
} from '../lib/project';
import { useEditorStore } from '../state/editorStore';

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

const DRAFT_SOURCE_ID = 'draft';
const OBJECTS_SOURCE_ID = 'objects';

const isFeatureSelectable = (feature: MapGeoJSONFeature | undefined): feature is MapGeoJSONFeature => {
  return Boolean(feature?.properties?.objectId);
};

const getCursorForState = (tool: string, dragging: boolean) => {
  if (dragging) {
    return 'grabbing';
  }

  if (tool === 'polygon') {
    return 'crosshair';
  }

  if (tool === 'move') {
    return 'grab';
  }

  return 'default';
};

export function MapCanvas({ onMapReady }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<Position[]>([]);
  const [hoverCoordinate, setHoverCoordinate] = useState<Position | null>(null);
  const {
    currentTool,
    project,
    selectedLayerId,
    selectedObjectId,
    setViewport,
    addObjectToSelectedLayer,
    selectObject,
  } = useEditorStore(
    useShallow((state) => ({
      currentTool: state.currentTool,
      project: state.project,
      selectedLayerId: state.selectedLayerId,
      selectedObjectId: state.selectedObjectId,
      setViewport: state.setViewport,
      addObjectToSelectedLayer: state.addObjectToSelectedLayer,
      selectObject: state.selectObject,
    })),
  );
  const currentToolRef = useRef(currentTool);
  const onMapReadyRef = useRef(onMapReady);
  const selectObjectRef = useRef(selectObject);
  const setViewportRef = useRef(setViewport);
  const initialViewportRef = useRef(project.viewport);
  const draftCoordinatesRef = useRef<Position[]>(draftCoordinates);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const draggingRef = useRef(false);

  const objectsGeoJson = useMemo(
    () => projectToFeatureCollection(project.layers, selectedObjectId),
    [project.layers, selectedObjectId],
  );
  const closeToStart = useMemo(() => {
    if (!hoverCoordinate || draftCoordinates.length < 3 || !mapRef.current) {
      return false;
    }

    const first = draftCoordinates[0];
    const map = mapRef.current;
    const firstPoint = map.project({ lng: first[0], lat: first[1] });
    const hoverPoint = map.project({ lng: hoverCoordinate[0], lat: hoverCoordinate[1] });
    return Math.hypot(firstPoint.x - hoverPoint.x, firstPoint.y - hoverPoint.y) < 12;
  }, [draftCoordinates, hoverCoordinate]);
  const draftGeoJson = useMemo(
    () =>
      draftPolygonToFeatureCollection(
        draftCoordinates as number[][],
        hoverCoordinate as number[] | null,
        closeToStart,
      ),
    [closeToStart, draftCoordinates, hoverCoordinate],
  );
  const objectsGeoJsonRef = useRef(objectsGeoJson);
  const draftGeoJsonRef = useRef(draftGeoJson);
  const closeToStartRef = useRef(closeToStart);

  useEffect(() => {
    currentToolRef.current = currentTool;
    onMapReadyRef.current = onMapReady;
    selectObjectRef.current = selectObject;
    setViewportRef.current = setViewport;
    draftCoordinatesRef.current = draftCoordinates;
    selectedLayerIdRef.current = selectedLayerId;
    objectsGeoJsonRef.current = objectsGeoJson;
    draftGeoJsonRef.current = draftGeoJson;
    closeToStartRef.current = closeToStart;
  }, [
    closeToStart,
    currentTool,
    draftCoordinates,
    draftGeoJson,
    objectsGeoJson,
    onMapReady,
    selectObject,
    selectedLayerId,
    setViewport,
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
      map.getCanvasContainer().style.cursor = getCursorForState(
        currentToolRef.current,
        draggingRef.current,
      );
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
          'line-color': ['coalesce', ['get', 'strokeColor'], '#ffffff'],
          'line-width': ['coalesce', ['get', 'strokeWidth'], 2],
          'line-opacity': ['coalesce', ['get', 'opacity'], 1],
        },
      });

      map.addLayer({
        id: 'points',
        type: 'circle',
        source: OBJECTS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': ['coalesce', ['get', 'fillColor'], '#45c4ff'],
          'circle-stroke-width': 2,
          'circle-stroke-color': ['coalesce', ['get', 'strokeColor'], '#ffffff'],
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
    });

    map.on('moveend', () => {
      draggingRef.current = false;
      updateCanvasCursor();
      const center = map.getCenter();
      setViewportRef.current({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      });
    });

    map.on('dragstart', () => {
      draggingRef.current = true;
      updateCanvasCursor();
    });

    map.on('dragend', () => {
      draggingRef.current = false;
      updateCanvasCursor();
    });

    map.on('click', 'polygon-fill', (event) => {
      if (currentToolRef.current !== 'move') {
        return;
      }

      const feature = event.features?.[0];
      if (isFeatureSelectable(feature)) {
        selectObjectRef.current(String(feature.properties.objectId), String(feature.properties.layerId));
      }
    });

    map.on('click', 'polygon-line', (event) => {
      if (currentToolRef.current !== 'move') {
        return;
      }

      const feature = event.features?.[0];
      if (isFeatureSelectable(feature)) {
        selectObjectRef.current(String(feature.properties.objectId), String(feature.properties.layerId));
      }
    });

    onMapReadyRef.current(map);
    mapRef.current = map;

    const finishPolygon = () => {
      const coords = draftCoordinatesRef.current;
      const layerId = selectedLayerIdRef.current;
      if (coords.length < 3 || !layerId) {
        return;
      }

      addObjectToSelectedLayer(createPolygonObject([...coords, coords[0]] as number[][]));
      setDraftCoordinates([]);
      setHoverCoordinate(null);
    };

    const handleMapClick = (event: MapMouseEvent) => {
      if (currentToolRef.current !== 'polygon') {
        return;
      }

      if (closeToStartRef.current) {
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
    };

    const handleDoubleClick = (event: MapMouseEvent) => {
      if (currentToolRef.current !== 'polygon') {
        return;
      }

      event.originalEvent.preventDefault();
      finishPolygon();
    };

    const handleMouseMove = (event: MapMouseEvent) => {
      if (currentToolRef.current !== 'polygon' || draftCoordinatesRef.current.length === 0) {
        setHoverCoordinate(null);
        return;
      }

      setHoverCoordinate([event.lngLat.lng, event.lngLat.lat]);
    };

    const handleMouseOut = () => {
      setHoverCoordinate(null);
    };

    const handleEmptySelection = () => {
      if (currentToolRef.current === 'move') {
        selectObjectRef.current(null, selectedLayerIdRef.current);
      }
    };

    map.on('click', handleMapClick);
    map.on('dblclick', handleDoubleClick);
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    map.on('click', handleEmptySelection);

    return () => {
      map.off('click', handleMapClick);
      map.off('dblclick', handleDoubleClick);
      map.off('mousemove', handleMouseMove);
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

    map.getCanvasContainer().style.cursor = getCursorForState(currentTool, draggingRef.current);

    if (currentTool === 'polygon') {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
      draftCoordinatesRef.current = [];
      setDraftCoordinates([]);
      setHoverCoordinate(null);
    }
  }, [currentTool]);

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
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/50 px-3 py-2 text-xs text-white">
          Click to add vertices. Double-click or click the first point to finish.
        </div>
      )}
    </div>
  );
}
