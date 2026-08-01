import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ViewModeControl } from '../app/ViewModeControl';

describe('ViewModeControl', () => {
  it('shows the active view and requests a view change', () => {
    const onChange = vi.fn();
    render(<ViewModeControl mode="2d" onChange={onChange} />);

    expect(screen.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    expect(onChange).toHaveBeenCalledWith('3d');
  });
});
