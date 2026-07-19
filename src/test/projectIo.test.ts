import { describe, expect, it } from 'vitest';

import { createEmptyProject, createPolygonObject } from '../lib/project';
import { parseProject, serializeProject } from '../project-io/file';

describe('project io', () => {
  it('round-trips a project', () => {
    const project = createEmptyProject();
    project.layers[0]?.objects.push(
      createPolygonObject([
        [10, 10],
        [15, 10],
        [15, 15],
        [10, 10],
      ]),
    );

    const serialized = serializeProject(project);
    const parsed = parseProject(serialized);

    expect(parsed.viewport).toEqual(project.viewport);
    expect(parsed.basemapPreset).toBe('road');
    expect(parsed.layers[0]?.objects[0]?.style.fillColor).toBe(
      project.layers[0]?.objects[0]?.style.fillColor,
    );
    expect(parsed.layers[0]?.objects[0]?.geometry).toEqual(project.layers[0]?.objects[0]?.geometry);
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
});
