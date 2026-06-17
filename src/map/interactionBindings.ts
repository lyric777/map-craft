import type { Geometry, Position } from 'geojson';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type maplibregl from 'maplibre-gl';

import type { MapcraftObject, ToolId } from '../types/project';
import type { ScreenPoint } from './types';

export interface MapInteractionBindings {
  map: maplibregl.Map;
  currentToolRef: MutableRefObject<ToolId>;
  selectedLayerIdRef: MutableRefObject<string | null>;
  selectedObjectRef: MutableRefObject<MapcraftObject | null>;
  selectObjectRef: MutableRefObject<(objectId: string | null, layerId?: string | null) => void>;
  updateSelectedObjectGeometryRef: MutableRefObject<(geometry: Geometry) => void>;
  addObjectToSelectedLayer: (object: MapcraftObject) => void;
  draftCoordinatesRef: MutableRefObject<Position[]>;
  closeToStartRef: MutableRefObject<boolean>;
  hoverVertexIndexRef: MutableRefObject<number | null>;
  dragVertexIndexRef: MutableRefObject<number | null>;
  previewVerticesRef: MutableRefObject<Position[] | null>;
  hoverObjectIdRef: MutableRefObject<string | null>;
  dragObjectIdRef: MutableRefObject<string | null>;
  previewObjectGeometryRef: MutableRefObject<Geometry | null>;
  objectDragStartRef: MutableRefObject<Position | null>;
  objectDragGeometryRef: MutableRefObject<Geometry | null>;
  dragMovedRef: MutableRefObject<boolean>;
  freeDrawScreenPointsRef: MutableRefObject<ScreenPoint[]>;
  isFreeDrawingRef: MutableRefObject<boolean>;
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
