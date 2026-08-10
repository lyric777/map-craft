import { describe, expect, it } from 'vitest';

import { createEmptyProject, createPolygonObject } from '../lib/project';
import { parseProject, serializeProject } from '../project-io/file';

describe('project io', () => {
  it('round-trips a project', () => {
    const project = createEmptyProject();
    const polygon = createPolygonObject([
        [10, 10],
        [15, 10],
        [15, 15],
        [10, 10],
      ]);
    polygon.style.extrusionHeight = 85;
    project.layers[0]?.objects.push(polygon);

    const serialized = serializeProject(project);
    const parsed = parseProject(serialized);

    expect(parsed.viewport).toEqual(project.viewport);
    expect(parsed.basemapPreset).toBe('road');
    expect(parsed.layers[0]?.objects[0]?.style.fillColor).toBe(
      project.layers[0]?.objects[0]?.style.fillColor,
    );
    expect(parsed.layers[0]?.objects[0]?.geometry).toEqual(project.layers[0]?.objects[0]?.geometry);
    expect(parsed.layers[0]?.objects[0]?.style.extrusionHeight).toBe(85);
  });

  it('preserves a basemap preset and migrates older appearance presets to road', () => {
    const project = createEmptyProject();
    project.basemapPreset = 'satellite';
    expect(parseProject(serializeProject(project)).basemapPreset).toBe('satellite');

    const legacyProject = structuredClone(project) as Partial<typeof project>;
    delete legacyProject.basemapPreset;
    expect(parseProject(JSON.stringify(legacyProject)).basemapPreset).toBe('road');
    expect(
      parseProject(JSON.stringify({ ...legacyProject, basemapPreset: 'dark' })).basemapPreset,
    ).toBe('road');
  });

  it('adds flat camera defaults to projects saved before perspective views', () => {
    const project = createEmptyProject();
    const legacyProject = structuredClone(project) as unknown as {
      viewport: { center: number[]; zoom: number; pitch?: number; bearing?: number };
    };
    delete legacyProject.viewport.pitch;
    delete legacyProject.viewport.bearing;

    expect(parseProject(JSON.stringify(legacyProject)).viewport).toEqual({
      center: [0, 20],
      zoom: 2.5,
      pitch: 0,
      bearing: 0,
    });
  });

  it('adds a flat height to objects saved before polygon extrusions', () => {
    const project = createEmptyProject();
    const polygon = createPolygonObject([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
    project.layers[0]?.objects.push(polygon);

    const legacyProject = structuredClone(project) as unknown as {
      layers: Array<{ objects: Array<{ style: { extrusionHeight?: number } }> }>;
    };
    delete legacyProject.layers[0]?.objects[0]?.style.extrusionHeight;

    expect(
      parseProject(JSON.stringify(legacyProject as unknown as typeof project)).layers[0]?.objects[0]
        ?.style.extrusionHeight,
    ).toBe(0);
  });
});
