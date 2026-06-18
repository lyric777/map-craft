import { describe, expect, it } from 'vitest';

import { ERASER_CURSOR, getCursorForState } from '../map/cursor';

describe('map cursor state', () => {
  it('uses crosshair for drawing tools', () => {
    expect(
      getCursorForState({
        tool: 'polygon',
        isMapDragging: false,
        isVertexHovering: false,
        isVertexDragging: false,
        isObjectHovering: false,
        isObjectDragging: false,
      }),
    ).toBe('crosshair');

    expect(
      getCursorForState({
        tool: 'freeDraw',
        isMapDragging: false,
        isVertexHovering: false,
        isVertexDragging: false,
        isObjectHovering: false,
        isObjectDragging: false,
      }),
    ).toBe('crosshair');
  });

  it('uses a dedicated eraser cursor for the eraser tool', () => {
    expect(
      getCursorForState({
        tool: 'eraser',
        isMapDragging: false,
        isVertexHovering: false,
        isVertexDragging: false,
        isObjectHovering: false,
        isObjectDragging: false,
      }),
    ).toBe(ERASER_CURSOR);
  });

  it('uses grab and grabbing for move interactions', () => {
    expect(
      getCursorForState({
        tool: 'move',
        isMapDragging: false,
        isVertexHovering: true,
        isVertexDragging: false,
        isObjectHovering: false,
        isObjectDragging: false,
      }),
    ).toBe('grab');

    expect(
      getCursorForState({
        tool: 'move',
        isMapDragging: false,
        isVertexHovering: false,
        isVertexDragging: false,
        isObjectHovering: true,
        isObjectDragging: false,
      }),
    ).toBe('grab');

    expect(
      getCursorForState({
        tool: 'move',
        isMapDragging: false,
        isVertexHovering: false,
        isVertexDragging: false,
        isObjectHovering: false,
        isObjectDragging: true,
      }),
    ).toBe('grabbing');
  });

  it('falls back to default for neutral move state', () => {
    expect(
      getCursorForState({
        tool: 'move',
        isMapDragging: false,
        isVertexHovering: false,
        isVertexDragging: false,
        isObjectHovering: false,
        isObjectDragging: false,
      }),
    ).toBe('default');
  });
});
