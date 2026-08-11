export const EXTRUSION_HEIGHT_SLIDER_MAX = 100;

const MIN_NON_ZERO_HEIGHT = 10;
const MAX_HEIGHT = 100_000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const extrusionSliderToHeight = (position: number) => {
  if (position <= 0) {
    return 0;
  }

  const normalizedPosition = (clamp(position, 1, EXTRUSION_HEIGHT_SLIDER_MAX) - 1) / 99;
  const rawHeight = 10 ** (1 + normalizedPosition * 4);
  const roundingStep = 10 ** Math.max(0, Math.floor(Math.log10(rawHeight)) - 1);

  return Math.round(rawHeight / roundingStep) * roundingStep;
};

export const extrusionHeightToSlider = (height: number) => {
  if (height <= 0) {
    return 0;
  }

  const clampedHeight = clamp(height, MIN_NON_ZERO_HEIGHT, MAX_HEIGHT);
  return 1 + ((Math.log10(clampedHeight) - 1) / 4) * 99;
};

export const formatExtrusionHeight = (height: number) => {
  if (height <= 0) {
    return 'Flat';
  }

  if (height < 1_000) {
    return `${height} m`;
  }

  const kilometers = height / 1_000;
  return `${Number.isInteger(kilometers) ? kilometers : kilometers.toFixed(1)} km`;
};
