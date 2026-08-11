import { describe, expect, it } from 'vitest';

import {
  extrusionHeightToSlider,
  extrusionSliderToHeight,
  formatExtrusionHeight,
} from '../lib/extrusionHeight';

describe('extrusion height slider', () => {
  it('covers building and map-scale heights on a logarithmic scale', () => {
    expect(extrusionSliderToHeight(0)).toBe(0);
    expect(extrusionSliderToHeight(1)).toBe(10);
    expect(extrusionSliderToHeight(50)).toBeCloseTo(950, -1);
    expect(extrusionSliderToHeight(100)).toBe(100_000);
  });

  it('keeps stored heights near the same slider position', () => {
    for (const height of [10, 100, 500, 1_000, 10_000, 100_000]) {
      const roundTrippedHeight = extrusionSliderToHeight(extrusionHeightToSlider(height));
      expect(roundTrippedHeight).toBeCloseTo(height, -Math.max(0, Math.floor(Math.log10(height)) - 1));
    }
  });

  it('formats meters, kilometers, and flat polygons', () => {
    expect(formatExtrusionHeight(0)).toBe('Flat');
    expect(formatExtrusionHeight(500)).toBe('500 m');
    expect(formatExtrusionHeight(10_000)).toBe('10 km');
    expect(formatExtrusionHeight(12_500)).toBe('12.5 km');
  });
});
