import type { ToolId } from '../types/project';

export const TOOL_LABELS: Record<ToolId, string> = {
  move: 'Move',
  freeDraw: 'Free Draw',
  point: 'Point',
  line: 'Line',
  polygon: 'Polygon',
};

export const TOOL_SHORTCUTS: Record<string, ToolId> = {
  v: 'move',
  f: 'freeDraw',
  p: 'point',
  l: 'line',
  b: 'polygon',
};
