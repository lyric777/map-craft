import { describe, expect, it, vi } from 'vitest';

import { POLYGON_EXTRUSION_LAYER_ID } from '../map/constants';
import { registerEditorLayers, setPolygonExtrusionsVisible } from '../map/layers';

describe('polygon extrusion layer', () => {
  it('registers hidden in 2D and visible in 3D', () => {
    const addLayer = vi.fn();

    registerEditorLayers({ addLayer } as never, false);
    const flatLayer = addLayer.mock.calls
      .map(([layer]) => layer)
      .find((layer) => layer.id === POLYGON_EXTRUSION_LAYER_ID);
    expect(flatLayer?.layout?.visibility).toBe('none');

    addLayer.mockClear();
    registerEditorLayers({ addLayer } as never, true);
    const raisedLayer = addLayer.mock.calls
      .map(([layer]) => layer)
      .find((layer) => layer.id === POLYGON_EXTRUSION_LAYER_ID);
    expect(raisedLayer?.layout?.visibility).toBe('visible');
    expect(raisedLayer?.paint?.['fill-extrusion-height']).toEqual([
      'coalesce',
      ['get', 'extrusionHeight'],
      0,
    ]);
  });

  it('changes visibility without rebuilding the layer', () => {
    const map = {
      getLayer: vi.fn(() => ({})),
      setLayoutProperty: vi.fn(),
    };

    setPolygonExtrusionsVisible(map as never, true);
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
      POLYGON_EXTRUSION_LAYER_ID,
      'visibility',
      'visible',
    );

    setPolygonExtrusionsVisible(map as never, false);
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
      POLYGON_EXTRUSION_LAYER_ID,
      'visibility',
      'none',
    );
  });
});
