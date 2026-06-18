import type { ToolId } from '../types/project';

const buildCursorUrl = (svgMarkup: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svgMarkup)}") ${x} ${y}, ${fallback}`;

const eraserSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
  <path
    d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"
    stroke="#fff"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="m5.082 11.09 8.828 8.828"
    stroke="#fff"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"
    stroke="#111"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="m5.082 11.09 8.828 8.828"
    stroke="#111"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;

export const ERASER_CURSOR = buildCursorUrl(eraserSvg, 5, 18, 'cell');

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

  if (tool === 'eraser') {
    return ERASER_CURSOR;
  }

  if (tool === 'point') {
    return 'cell';
  }

  if (tool === 'line' || tool === 'polygon' || tool === 'freeDraw') {
    return 'crosshair';
  }

  return 'default';
};
