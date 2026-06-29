import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../App';
import { useEditorStore } from '../state/editorStore';

vi.mock('../map/MapCanvas', () => ({
  MapCanvas: ({ onMapReady }: { onMapReady: (map: unknown) => void }) => {
    const canvas = document.createElement('canvas');
    canvas.toBlob = (callback: BlobCallback) => callback(new Blob(['png']));
    onMapReady({
      getCanvas: () => canvas,
    });
    return <div data-testid="map-canvas">Mock Map</div>;
  },
}));

describe('App', () => {
  beforeEach(() => {
    useEditorStore.getState().newProject();
  });

  it('renders the editor shell', () => {
    render(<App />);

    expect(screen.getByText('MapCraft')).toBeInTheDocument();
    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toBeInTheDocument();
  });

  it('toggles the theme runtime state', async () => {
    render(<App />);

    fireEvent.click(screen.getByLabelText(/switch to light theme/i));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(screen.getByTestId('app-shell')).toHaveAttribute('data-theme', 'light');
    });
  });

  it('does not let modifier shortcuts get swallowed by tool hotkeys', async () => {
    const store = useEditorStore.getState();
    store.addObjectToSelectedLayer({
      id: 'point-1',
      type: 'point',
      geometry: {
        type: 'Point',
        coordinates: [10, 20],
      },
      style: {
        fillColor: '#45c4ff',
        strokeColor: '#ffffff',
        strokeWidth: 2,
        opacity: 0.45,
      },
      meta: {},
    });

    render(<App />);

    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    fireEvent.keyDown(window, { key: 'v', metaKey: true });

    await waitFor(() => {
      expect(useEditorStore.getState().project.layers[0]?.objects).toHaveLength(2);
      expect(useEditorStore.getState().clipboardObject?.id).toBe('point-1');
      expect(useEditorStore.getState().currentTool).toBe('move');
      expect(screen.getByText('Clipboard pasted into the active layer.')).toBeInTheDocument();
    });
  });
});
