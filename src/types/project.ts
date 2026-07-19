import type { Geometry, Position } from 'geojson';

export type MapObjectType = 'point' | 'line' | 'polygon';
export type ToolId = 'move' | 'freeDraw' | 'eraser' | 'point' | 'line' | 'polygon';
export type BasemapPresetId = 'road' | 'satellite' | 'terrain' | 'hydrography' | 'none';

export interface MapObjectStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface MapcraftObject {
  id: string;
  type: MapObjectType;
  geometry: Geometry;
  style: MapObjectStyle;
  meta: Record<string, unknown>;
}

export interface MapcraftLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  objects: MapcraftObject[];
}

export interface MapcraftViewport {
  center: Position;
  zoom: number;
}

export interface MapcraftProject {
  version: '0.1';
  basemapPreset: BasemapPresetId;
  viewport: MapcraftViewport;
  layers: MapcraftLayer[];
}
