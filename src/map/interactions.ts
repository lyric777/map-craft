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
    if (editing.handleMapMouseDown(event)) {
      return;
    }
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
