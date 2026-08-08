import type maplibregl from 'maplibre-gl';
import type { HillshadeLayerSpecification, RasterDEMSourceSpecification } from 'maplibre-gl';

export const TERRAIN_DEM_SOURCE_ID = 'terrain-dem';
export const TERRAIN_HILLSHADE_LAYER_ID = 'terrain-hillshade';
export const TERRAIN_EXAGGERATION = 1;

const FIRST_EDITOR_LAYER_ID = 'polygon-fill';

export const TERRAIN_HILLSHADE_LAYER: HillshadeLayerSpecification = {
  id: TERRAIN_HILLSHADE_LAYER_ID,
  type: 'hillshade',
  source: TERRAIN_DEM_SOURCE_ID,
  layout: {
    visibility: 'visible',
  },
  paint: {
    'hillshade-exaggeration': 0.3,
    'hillshade-shadow-color': '#334155',
    'hillshade-highlight-color': '#ffffff',
    'hillshade-accent-color': '#64748b',
  },
};

export const TERRAIN_DEM_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  url: 'https://tiles.mapterhorn.com/tilejson.json',
  tileSize: 512,
  encoding: 'terrarium',
  attribution: '<a href="https://mapterhorn.com/attribution">&copy; Mapterhorn</a>',
};

export const setTerrainEnabled = (map: maplibregl.Map, enabled: boolean) => {
  try {
    const currentTerrain = map.getTerrain();

    if (!enabled) {
      if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
        map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', 'none');
      }
      if (currentTerrain) {
        map.setTerrain(null);
      }
      return true;
    }

    if (!map.getSource(TERRAIN_DEM_SOURCE_ID)) {
      map.addSource(TERRAIN_DEM_SOURCE_ID, TERRAIN_DEM_SOURCE);
    }

    if (!map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
      const beforeId = map.getLayer(FIRST_EDITOR_LAYER_ID) ? FIRST_EDITOR_LAYER_ID : undefined;
      map.addLayer(TERRAIN_HILLSHADE_LAYER, beforeId);
    } else {
      map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', 'visible');
    }

    if (
      currentTerrain?.source === TERRAIN_DEM_SOURCE_ID &&
      currentTerrain.exaggeration === TERRAIN_EXAGGERATION
    ) {
      return true;
    }

    map.setTerrain({
      source: TERRAIN_DEM_SOURCE_ID,
      exaggeration: TERRAIN_EXAGGERATION,
    });
    return true;
  } catch {
    try {
      map.setTerrain(null);
    } catch {
      // The style may not be ready yet; the map load handler will try again.
    }
    return false;
  }
};
