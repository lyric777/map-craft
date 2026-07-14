import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BasemapControl } from '../app/BasemapControl';
import {
  applyBasemapPreset,
  BASEMAP_BACKGROUND_LAYER_ID,
  BASEMAP_PRESETS,
  BASEMAP_RASTER_LAYER_ID,
  getBasemapPreset,
} from '../map/basemap';

describe('basemap presets', () => {
  it('defines all V1 presets and applies their map properties', () => {
    expect(BASEMAP_PRESETS.map((preset) => preset.id)).toEqual([
      'standard',
      'light',
      'dark',
      'grayscale',
      'none',
    ]);

    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    const map = {
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
      setLayoutProperty,
    };

    applyBasemapPreset(map as never, 'none');

    expect(setPaintProperty).toHaveBeenCalledWith(
      BASEMAP_BACKGROUND_LAYER_ID,
      'background-color',
      getBasemapPreset('none').backgroundColor,
    );
    expect(setLayoutProperty).toHaveBeenCalledWith(
      BASEMAP_RASTER_LAYER_ID,
      'visibility',
      'none',
    );
  });

  it('opens the menu, marks the active preset, and selects another preset', () => {
    const onChange = vi.fn();
    render(<BasemapControl preset="standard" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose basemap style' }));
    expect(screen.getByRole('menuitemradio', { name: 'Standard' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('menu', { name: 'Basemap styles' })).not.toBeInTheDocument();
  });
});
