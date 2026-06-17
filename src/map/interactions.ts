import maplibregl from 'maplibre-gl';

import { createDrawingHandlers } from './drawingInteractions';
import { createEditingHandlers } from './editingInteractions';
import type { MapInteractionBindings } from './interactionBindings';

export const bindMapInteractions = ({
  map,
  ...bindings
}: MapInteractionBindings) => {
  const editing = createEditingHandlers({ map, ...bindings });
  const drawing = createDrawingHandlers({ map, ...bindings });
  const handleMouseDown = (event: maplibregl.MapMouseEvent) => {
    drawing.handleMouseDown(event);
  };
  const handleClick = (event: maplibregl.MapMouseEvent) => {
    if (editing.handleMapClick(event)) {
      return;
    }
    drawing.handleMapClick(event);
  };
  const handleDoubleClick = (event: maplibregl.MapMouseEvent) => {
    drawing.handleDoubleClick(event);
  };
  const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
    if (editing.handleMouseMove(event)) {
      return;
    }
    drawing.handleMouseMove(event);
  };
  const handleMouseUp = () => {
    if (drawing.handleMouseUp()) {
      return;
    }
    editing.handleMouseUp();
  };

  map.on('mouseenter', 'polygon-fill-hit', editing.handleObjectMouseEnter);
  map.on('mouseenter', 'polygon-line-hit', editing.handleObjectMouseEnter);
  map.on('mouseenter', 'line-string-hit', editing.handleObjectMouseEnter);
  map.on('mouseenter', 'points-hit', editing.handleObjectMouseEnter);
  map.on('mouseleave', 'polygon-fill-hit', editing.handleObjectMouseLeave);
  map.on('mouseleave', 'polygon-line-hit', editing.handleObjectMouseLeave);
  map.on('mouseleave', 'line-string-hit', editing.handleObjectMouseLeave);
  map.on('mouseleave', 'points-hit', editing.handleObjectMouseLeave);
  map.on('mousedown', 'polygon-fill-hit', editing.handleObjectMouseDown);
  map.on('mousedown', 'polygon-line-hit', editing.handleObjectMouseDown);
  map.on('mousedown', 'line-string-hit', editing.handleObjectMouseDown);
  map.on('mousedown', 'points-hit', editing.handleObjectMouseDown);
  map.on('mouseenter', 'edit-vertex-hit', editing.handleVertexMouseEnter);
  map.on('mouseleave', 'edit-vertex-hit', editing.handleVertexMouseLeave);
  map.on('mousedown', 'edit-vertex-hit', editing.handleVertexMouseDown);
  map.on('mousedown', handleMouseDown);
  map.on('click', handleClick);
  map.on('dblclick', handleDoubleClick);
  map.on('mousemove', handleMouseMove);
  map.on('mouseup', handleMouseUp);
  map.on('mouseout', editing.handleMouseOut);

  return () => {
    map.off('mouseenter', 'polygon-fill-hit', editing.handleObjectMouseEnter);
    map.off('mouseenter', 'polygon-line-hit', editing.handleObjectMouseEnter);
    map.off('mouseenter', 'line-string-hit', editing.handleObjectMouseEnter);
    map.off('mouseenter', 'points-hit', editing.handleObjectMouseEnter);
    map.off('mouseleave', 'polygon-fill-hit', editing.handleObjectMouseLeave);
    map.off('mouseleave', 'polygon-line-hit', editing.handleObjectMouseLeave);
    map.off('mouseleave', 'line-string-hit', editing.handleObjectMouseLeave);
    map.off('mouseleave', 'points-hit', editing.handleObjectMouseLeave);
    map.off('mousedown', 'polygon-fill-hit', editing.handleObjectMouseDown);
    map.off('mousedown', 'polygon-line-hit', editing.handleObjectMouseDown);
    map.off('mousedown', 'line-string-hit', editing.handleObjectMouseDown);
    map.off('mousedown', 'points-hit', editing.handleObjectMouseDown);
    map.off('mouseenter', 'edit-vertex-hit', editing.handleVertexMouseEnter);
    map.off('mouseleave', 'edit-vertex-hit', editing.handleVertexMouseLeave);
    map.off('mousedown', 'edit-vertex-hit', editing.handleVertexMouseDown);
    map.off('mousedown', handleMouseDown);
    map.off('click', handleClick);
    map.off('dblclick', handleDoubleClick);
    map.off('mousemove', handleMouseMove);
    map.off('mouseup', handleMouseUp);
    map.off('mouseout', editing.handleMouseOut);
  };
};
