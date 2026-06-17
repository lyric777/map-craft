import type { Geometry, Position } from 'geojson';
import type { Dispatch, SetStateAction } from 'react';
import type maplibregl from 'maplibre-gl';

import type { MapcraftObject, ToolId } from '../types/project';
import type { ScreenPoint } from './types';

export interface WritableRef<T> {
  current: T;
}

export interface MapInteractionBindings {
  map: maplibregl.Map;
  currentToolRef: WritableRef<ToolId>;
  selectedLayerIdRef: WritableRef<string | null>;
  selectedObjectRef: WritableRef<MapcraftObject | null>;
  selectObjectRef: WritableRef<(objectId: string | null, layerId?: string | null) => void>;
  updateSelectedObjectGeometryRef: WritableRef<(geometry: Geometry) => void>;
  addObjectToSelectedLayer: (object: MapcraftObject) => void;
  draftCoordinatesRef: WritableRef<Position[]>;
  closeToStartRef: WritableRef<boolean>;
  hoverVertexIndexRef: WritableRef<number | null>;
  dragVertexIndexRef: WritableRef<number | null>;
  previewVerticesRef: WritableRef<Position[] | null>;
  hoverObjectIdRef: WritableRef<string | null>;
  dragObjectIdRef: WritableRef<string | null>;
  previewObjectGeometryRef: WritableRef<Geometry | null>;
  objectDragStartRef: WritableRef<Position | null>;
  objectDragGeometryRef: WritableRef<Geometry | null>;
  dragMovedRef: WritableRef<boolean>;
  freeDrawScreenPointsRef: WritableRef<ScreenPoint[]>;
  isFreeDrawingRef: WritableRef<boolean>;
  setDraftCoordinates: Dispatch<SetStateAction<Position[]>>;
  setHoverCoordinate: Dispatch<SetStateAction<Position | null>>;
  setHoverVertexIndex: Dispatch<SetStateAction<number | null>>;
  setDragVertexIndex: Dispatch<SetStateAction<number | null>>;
  setPreviewVertices: Dispatch<SetStateAction<Position[] | null>>;
  setHoverObjectId: Dispatch<SetStateAction<string | null>>;
  setDragObjectId: Dispatch<SetStateAction<string | null>>;
  setPreviewObjectGeometry: Dispatch<SetStateAction<Geometry | null>>;
  setFreeDrawScreenPoints: Dispatch<SetStateAction<ScreenPoint[]>>;
  setIsFreeDrawing: Dispatch<SetStateAction<boolean>>;
  updateCanvasCursor: () => void;
  resetVertexEditing: () => void;
  resetFreeDraw: () => void;
}
