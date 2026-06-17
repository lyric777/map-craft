import type { ToolId } from '../types/project';

export interface CursorState {
  tool: ToolId;
  isMapDragging: boolean;
  isVertexHovering: boolean;
  isVertexDragging: boolean;
  isObjectHovering: boolean;
  isObjectDragging: boolean;
}

export const getCursorForState = ({
  tool,
  isMapDragging,
  isVertexHovering,
  isVertexDragging,
  isObjectHovering,
  isObjectDragging,
}: CursorState) => {
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
