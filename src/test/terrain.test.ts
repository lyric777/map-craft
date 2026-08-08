import { describe, expect, it, vi } from 'vitest';

import {
  setTerrainEnabled,
  TERRAIN_DEM_SOURCE,
  TERRAIN_DEM_SOURCE_ID,
  TERRAIN_EXAGGERATION,
  TERRAIN_HILLSHADE_LAYER,
  TERRAIN_HILLSHADE_LAYER_ID,
} from '../map/terrain';

describe('terrain mode', () => {
  it('adds the DEM source once and enables terrain at real scale', () => {
    const map = {
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getLayer: vi.fn(() => undefined),
      getTerrain: vi.fn((): { source: string; exaggeration: number } | null => null),
      getSource: vi.fn(() => undefined),
      setLayoutProperty: vi.fn(),
      setTerrain: vi.fn(),
    };

    expect(setTerrainEnabled(map as never, true)).toBe(true);
    expect(map.addSource).toHaveBeenCalledWith(TERRAIN_DEM_SOURCE_ID, TERRAIN_DEM_SOURCE);
    expect(map.addLayer).toHaveBeenCalledWith(TERRAIN_HILLSHADE_LAYER, undefined);
    expect(map.setTerrain).toHaveBeenCalledWith({
      source: TERRAIN_DEM_SOURCE_ID,
      exaggeration: TERRAIN_EXAGGERATION,
    });
  });

  it('reuses an existing source and disables terrain', () => {
    const source = {};
    const map = {
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getLayer: vi.fn((id: string) =>
        id === TERRAIN_HILLSHADE_LAYER_ID ? { id: TERRAIN_HILLSHADE_LAYER_ID } : undefined,
      ),
      getTerrain: vi.fn((): { source: string; exaggeration: number } | null => null),
      getSource: vi.fn(() => source),
      setLayoutProperty: vi.fn(),
      setTerrain: vi.fn(),
    };

    expect(setTerrainEnabled(map as never, true)).toBe(true);
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
      TERRAIN_HILLSHADE_LAYER_ID,
      'visibility',
      'visible',
    );

    map.getTerrain.mockReturnValue({
      source: TERRAIN_DEM_SOURCE_ID,
      exaggeration: TERRAIN_EXAGGERATION,
    });
    expect(setTerrainEnabled(map as never, false)).toBe(true);
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
      TERRAIN_HILLSHADE_LAYER_ID,
      'visibility',
      'none',
    );
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
  });

  it('keeps hillshade below editor objects when terrain starts after load', () => {
    const map = {
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getLayer: vi.fn((id: string) => (id === 'polygon-fill' ? { id: 'polygon-fill' } : undefined)),
      getTerrain: vi.fn(() => null),
      getSource: vi.fn(() => ({})),
      setLayoutProperty: vi.fn(),
      setTerrain: vi.fn(),
    };

    expect(setTerrainEnabled(map as never, true)).toBe(true);
    expect(map.addLayer).toHaveBeenCalledWith(TERRAIN_HILLSHADE_LAYER, 'polygon-fill');
  });

  it('falls back to flat perspective when terrain setup fails', () => {
    const map = {
      addSource: vi.fn(() => {
        throw new Error('DEM unavailable');
      }),
      addLayer: vi.fn(),
      getLayer: vi.fn(() => undefined),
      getTerrain: vi.fn(() => null),
      getSource: vi.fn(() => undefined),
      setLayoutProperty: vi.fn(),
      setTerrain: vi.fn(),
    };

    expect(setTerrainEnabled(map as never, true)).toBe(false);
    expect(map.setTerrain).toHaveBeenCalledWith(null);
  });
});
