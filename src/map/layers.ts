import maplibregl from 'maplibre-gl';

import { DRAFT_SOURCE_ID, EDIT_SOURCE_ID, OBJECTS_SOURCE_ID } from './constants';

export const registerEditorLayers = (map: maplibregl.Map) => {
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
    filter: ['has', 'vertexIndex'],
    paint: {
      'circle-radius': 12,
      'circle-opacity': 0,
    },
  });

  map.addLayer({
    id: 'edit-vertices',
    type: 'circle',
    source: EDIT_SOURCE_ID,
    filter: ['has', 'vertexIndex'],
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

  map.addLayer({
    id: 'edit-snap-target',
    type: 'circle',
    source: EDIT_SOURCE_ID,
    filter: ['==', ['get', 'isSnapTarget'], true],
    paint: {
      'circle-radius': 10,
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffd166',
    },
  });
};
