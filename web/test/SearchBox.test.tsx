import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { SearchBox } from '../src/ui/SearchBox';

/** Renders the current route's path + query so we can assert on navigation, not internals. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderAt(initialPath: string, props: ComponentProps<typeof SearchBox> = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SearchBox {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('SearchBox debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not navigate before the 300ms debounce elapses', () => {
    renderAt('/search');

    type(screen.getByRole('searchbox'), 'segmentation');
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/search');
    expect(screen.getByTestId('location').textContent).not.toContain('?q=');
  });

  it('writes ?q= to the URL once the debounce elapses', () => {
    renderAt('/search');

    type(screen.getByRole('searchbox'), 'segmentation');
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=segmentation');
  });

  it('resets the debounce timer on every keystroke, so a rapid burst only commits the final value once', () => {
    renderAt('/search');
    const input = screen.getByRole('searchbox');

    type(input, 'seg');
    act(() => {
      vi.advanceTimersByTime(200); // short of 300ms — must not have committed yet
    });
    type(input, 'segmentation');
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByTestId('location').textContent).not.toContain('?q=');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=segmentation');
  });

  it('navigates to targetPath (e.g. Home -> /search) rather than rewriting the current path', () => {
    renderAt('/', { targetPath: '/search' });

    type(screen.getByRole('searchbox'), 'Yuan Xue');
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=Yuan%20Xue');
  });
});
