# MapCraft Handoff

## Current Resume Point

Current state:

- usable front-end map editor prototype
- single MapLibre viewport
- local-only editing workflow

Recent finished work:

- basemap appearance presets: Standard, Light, Dark, Grayscale, and No Basemap
- vertex snapping V1 for line / polygon vertex dragging
- copy / paste with app-internal clipboard
- map-area toast feedback for copy / paste
- lock layer with actual interaction blocking
- undo / redo coverage review for core store mutations

Current known status:

- no currently known must-fix undo / redo bug
- core drawing / editing loop is in a usable state
- main remaining risk area is interaction polish, not base architecture

Most likely next feature should be chosen from the broader product backlog, including:

- map visual styles
- brush / stroke styles
- third-party terrain / satellite basemap sources
- geographic change recording / timeline design
- free draw / eraser interaction polish

Product decision:

- do not add `Move Selected Object To Layer`; copying to the target layer and deleting the original is the accepted workflow

Important caution for the next thread:

- do not refactor `MapCanvas` lifecycle casually
- do not treat layers as separate canvases
- do not collapse free draw into generic line behavior
- do not implement lock layer as UI-only disablement
- preserve existing interaction semantics unless fixing a clear bug

## Product Positioning

MapCraft is a visual map creation studio, not a GIS tool.

The intended mental model is:

- "Figma for Maps"
- direct manipulation first
- fast editing over feature breadth
- minimal UI, clear interaction
- front-end only for now

Explicitly out of scope for the current project direction:

- backend services
- collaboration
- plugin system
- enterprise GIS workflows
- data analysis tooling

## Core Principles

- Users should draw and edit maps visually, not technically.
- The map is a canvas with geographic context, not a GIS workspace.
- Click -> immediate visible result.
- Editing speed matters more than feature count.

## Current Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- MapLibre GL JS

## Current Implemented Features

### Map

- single MapLibre viewport
- pan / zoom
- OSM raster basemap
- project-persisted basemap appearance presets
- viewport persisted in project file

### Drawing

- Point
- Line
- Polygon
- Free Draw
- Eraser for free draw

### Editing

- object select
- object drag
- point drag
- line/polygon vertex drag
- line/polygon insert vertex
- line/polygon delete vertex
- delete object
- duplicate object
- copy / paste via app-internal clipboard

### Layers

- add layer
- rename layer
- toggle visibility
- reorder layer
- lock layer

### Project IO

- new project
- save `.mapcraft`
- open `.mapcraft`
- export PNG

### Theme / UI

- dark / light runtime theme switch
- map-area toast for copy/paste feedback
- session panel status messages

## Architecture Map

### Main Files

- `src/App.tsx`
  - app shell
  - global keyboard shortcuts
  - status text
  - map toast lifecycle
  - wiring between panels and store

- `src/state/editorStore.ts`
  - single editor state source
  - project / selection / history / clipboard
  - all core mutations
  - undo / redo

- `src/map/MapCanvas.tsx`
  - MapLibre lifecycle
  - source/layer data sync
  - cursor updates
  - map instructions / map toast rendering
  - glue between state and interaction modules

- `src/map/drawingInteractions.ts`
  - point / line / polygon drawing
  - free draw
  - eraser interaction

- `src/map/editingInteractions.ts`
  - move-mode interactions
  - object selection
  - object drag
  - vertex drag
  - insert/delete vertex
  - lock-aware hit filtering

- `src/map/layers.ts`
  - MapLibre layer registration
  - object styling
  - draft / edit / hit layers

- `src/map/interactions.ts`
  - binds drawing + editing handlers to map events

- `src/lib/project.ts`
  - project creation helpers
  - geometry helpers
  - free draw smooth/simplify
  - eraser trimming logic
  - feature projection helpers

- `src/app/*`
  - `TopBar.tsx`
  - `ToolBar.tsx`
  - `LayerPanel.tsx`
  - `InspectorPanel.tsx`

## Important Interaction Semantics

### Single Viewport

There is only one MapLibre viewport.

Layers are not separate canvases. They are organizational groupings of objects rendered in the same map world.

Consequences:

- all layers share the same center / zoom
- cross-layer copy/paste does not change scale semantics
- layer changes never imply separate projections or artboards

### Free Draw

Free draw is stored as a `LineString`, but should be treated as a separate interaction mode and editing category.

Important rules:

- free draw does not participate in vertex insert/delete
- free draw supports whole-object movement, delete, duplicate, copy/paste
- eraser can split one free draw stroke into multiple resulting objects

### Polygon Editing

Polygon editing works on the open vertex list.

When writing geometry back:

- the closing coordinate is automatically re-added

Delete rules:

- line with fewer than 2 points after delete => delete whole object
- polygon with fewer than 3 points after delete => delete whole object

### Clipboard

Copy/paste is app-internal, not system clipboard backed.

Rules:

- `Copy` stores selected object in Zustand clipboard state
- `Paste` inserts into the current selected layer
- pasted object gets a new id
- pasted object is offset slightly from original
- pasted object becomes selected

### Layer Lock

`Lock Layer` means the layer remains visible but becomes non-interactive.

Locked layer objects must not:

- hover-highlight
- be selected
- be dragged
- be vertex-edited
- be insert/delete-vertex targets

This is not a visual stacking feature. It is an editing-permission feature.

## Current Keyboard Shortcuts

- `V` Move
- `F` Free Draw
- `E` Eraser
- `P` Point
- `L` Line
- `B` Polygon
- `Delete` Remove
- `Ctrl/Cmd+C` Copy
- `Ctrl/Cmd+V` Paste
- `Ctrl/Cmd+D` Duplicate
- `Ctrl/Cmd+Z` Undo
- `Ctrl/Cmd+Shift+Z` Redo

Important shortcut rule:

- modifier shortcuts must be handled before tool hotkeys
- this matters because `Cmd/Ctrl+V` used to be accidentally swallowed by `V -> Move`

## Known Gotchas / Historical Bugs

These are worth preserving because they were already debugged once.

### 1. Do not accidentally rebuild the map

`MapCanvas` map creation must not depend on unstable callbacks.

A prior bug caused:

- map flicker
- viewport reset to initial state
- mode toggle causing full map recreation

The fix was to keep unstable callbacks in refs instead of tying them directly to the map creation effect.

### 2. Modifier shortcut priority matters

`Cmd/Ctrl+V` was previously intercepted by the `V -> Move` tool shortcut.

Current rule:

- handle modifier shortcuts first
- only use single-key tool switching when no modifier is present

### 3. Free draw sourceObjectId must not leak into copies

`sourceObjectId` is for eraser split-group replacement, not for generic duplication semantics.

When duplicating or pasting free draw objects:

- do not preserve old `sourceObjectId`

Otherwise later replacement operations can incorrectly treat separate objects as one split group.

### 4. Layer lock must be enforced in interaction hit paths

It is not enough to show a lock icon or disable a panel button.

Hit testing / interaction handlers must explicitly ignore locked layer features.

## Current Undo / Redo Status

Undo/redo is currently covered in tests for:

- object creation
- geometry update
- clipboard paste
- layer visibility toggle
- layer lock toggle
- layer add
- layer rename
- layer reorder

Still worth manual smoke testing when making future changes:

- free draw -> eraser -> undo/redo
- drag vertex -> undo/redo
- locked layer + mode switching + undo/redo

## Suggested Next Steps

Vertex snapping V1 is complete. It currently:

- snaps a dragged line / polygon vertex to vertices on other point, line, or polygon objects
- snaps a whole dragged point, line, or polygon by its nearest vertex while preserving its shape
- uses a 10px screen-space threshold
- ignores hidden layers, locked layers, free draw strokes, and the selected object itself
- shows a yellow snap-target ring

If continuing from the current state, choose the next feature from the product backlog rather than assuming interaction polish is always highest priority:

1. brush / stroke styles
2. map visual styles beyond the basemap
3. third-party terrain / satellite basemap sources
4. geographic change recording / timeline design
5. free draw / eraser interaction polish

Lower priority for now:

- 3D
- backend
- collaboration
- plugin system
- context menu / command palette

## Recommended Commands

```bash
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## Recommended Read Order For A New Thread

Before making changes, a new assistant/thread should read:

1. `src/state/editorStore.ts`
2. `src/map/MapCanvas.tsx`
3. `src/map/drawingInteractions.ts`
4. `src/map/editingInteractions.ts`
5. `src/lib/project.ts`
6. `src/app/LayerPanel.tsx`
7. `src/app/InspectorPanel.tsx`

## Suggested Prompt For Continuing In A New Account / Thread

You can paste the following into a new conversation:

```md
This repo is MapCraft, a visual map creation studio, not a GIS tool.

Please first read:
- src/state/editorStore.ts
- src/map/MapCanvas.tsx
- src/map/drawingInteractions.ts
- src/map/editingInteractions.ts
- src/lib/project.ts

Important constraints:
- single MapLibre viewport
- layers are organizational, not separate canvases
- free draw is treated specially even though it is stored as LineString
- free draw does not participate in vertex insert/delete
- lock layer means fully non-interactive, not reordered
- copy/paste is app-internal clipboard and pastes into current selected layer

Please preserve existing architecture and interaction semantics unless there is a clear bug.
Run tests/lint after meaningful changes.
```

## Practical Handoff Advice

When resuming in a new account/thread:

- give the new assistant this file first
- then state the single next feature you want
- avoid asking it to "re-architect" before it reads the current interaction flow

The current project is at the point where preserving existing semantics is more important than inventing new structure.

## Strategic Feature Direction

3D is an important future differentiator for MapCraft and should be treated as one of the project's core long-term highlights.

The intended value is not "3D for its own sake", but making map creation feel more expressive and native to terrain-aware worldbuilding.

Examples of why this matters:

- terrain-aware visual map design
- elevation / hillshade driven composition
- more immersive fantasy / military / worldbuilding workflows
- a clearer product distinction from flat drawing tools

Important constraint:

- 3D is a strategic direction, not a currently active implementation track in the codebase
- do not assume the current architecture has already been adapted for 3D workflows
- do not start restructuring the editor for 3D unless there is a concrete approved implementation plan

In short:

- yes, 3D is part of the project's identity and future promise
- no, it should not distort current implementation decisions before a real plan exists
