import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BasemapControl } from '../app/BasemapControl';
import {
  applyBasemapPreset,
  BASEMAP_BACKGROUND_LAYER_ID,
  BASEMAP_HYDROGRAPHY_LAYER_IDS,
  BASEMAP_PRESETS,
  BASEMAP_ROAD_LAYER_ID,
  BASEMAP_TERRAIN_LAYER_ID,
  getBasemapPreset,
} from '../map/basemap';

describe('basemap presets', () => {
  it('defines content-based basemaps and applies layer visibility', () => {
    expect(BASEMAP_PRESETS.map((preset) => preset.id)).toEqual([
      'road',
      'terrain',
      'hydrography',
      'none',
    ]);

    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    const map = {
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
      setLayoutProperty,
    };

    applyBasemapPreset(map as never, 'hydrography');

    expect(setPaintProperty).toHaveBeenCalledWith(
      BASEMAP_BACKGROUND_LAYER_ID,
      'background-color',
      getBasemapPreset('hydrography').backgroundColor,
    );
    expect(setLayoutProperty).toHaveBeenCalledWith(
      BASEMAP_ROAD_LAYER_ID,
      'visibility',
      'none',
    );
    expect(setLayoutProperty).toHaveBeenCalledWith(
      BASEMAP_TERRAIN_LAYER_ID,
      'visibility',
      'none',
    );
    BASEMAP_HYDROGRAPHY_LAYER_IDS.forEach((layerId) => {
      expect(setLayoutProperty).toHaveBeenCalledWith(layerId, 'visibility', 'visible');
    });
  });

  it('opens the menu, marks the active basemap, and selects another one', () => {
    const onChange = vi.fn();
    render(<BasemapControl preset="road" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose basemap style' }));
    expect(screen.getByRole('menuitemradio', { name: /Road/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Terrain/ }));
    expect(onChange).toHaveBeenCalledWith('terrain');
    expect(screen.queryByRole('menu', { name: 'Basemap styles' })).not.toBeInTheDocument();
  });
});
