import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../App';

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
});
