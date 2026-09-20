import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { SearchBox } from '../src/ui/SearchBox';

/** Renders the current route's path + query so we can assert on navigation, not internals. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

/** Changes the URL from outside the search box, the way browser back/forward does. */
function ElsewhereLink({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>Go elsewhere</button>;
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

const location = () => screen.getByTestId('location');

describe('SearchBox commits only on submit', () => {
  it('never navigates from typing alone, however long you wait', () => {
    vi.useFakeTimers();
    try {
      renderAt('/search');

      type(screen.getByRole('searchbox'), 'segmentation');
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(location()).toHaveTextContent('/search');
      expect(location().textContent).not.toContain('?q=');
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes ?q= when the Search button is clicked', () => {
    renderAt('/search');

    type(screen.getByRole('searchbox'), 'segmentation');
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(location()).toHaveTextContent('/search?q=segmentation');
  });

  it('writes ?q= when Enter submits the form', () => {
    renderAt('/search');
    const input = screen.getByRole('searchbox');

    type(input, 'segmentation');
    fireEvent.submit(input.closest('form')!);

    expect(location()).toHaveTextContent('/search?q=segmentation');
  });

  it('puts the input in a form, so the phone keyboard Go/Search key submits it', () => {
    renderAt('/search');
    expect(screen.getByRole('searchbox').closest('form')).toBeInTheDocument();
  });

  it('navigates to targetPath (e.g. Home -> /search) rather than rewriting the current path', () => {
    renderAt('/', { targetPath: '/search' });

    type(screen.getByRole('searchbox'), 'Yuan Xue');
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(location()).toHaveTextContent('/search?q=Yuan%20Xue');
  });

  it('clears ?q= when an emptied box is submitted', () => {
    renderAt('/search?q=segmentation');
    const input = screen.getByRole('searchbox');

    type(input, '');
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(location()).toHaveTextContent('/search');
    expect(location().textContent).not.toContain('?q=');
  });

  it('treats a whitespace-only query as empty', () => {
    renderAt('/search?q=segmentation');

    type(screen.getByRole('searchbox'), '   ');
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(location().textContent).not.toContain('?q=');
  });

  it('resyncs the box when the URL query changes from outside (e.g. browser back)', () => {
    render(
      <MemoryRouter initialEntries={['/search?q=first']}>
        <SearchBox />
        <ElsewhereLink to="/search?q=second" />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByRole('searchbox')).toHaveValue('first');

    fireEvent.click(screen.getByRole('button', { name: /go elsewhere/i }));

    expect(location()).toHaveTextContent('/search?q=second');
    expect(screen.getByRole('searchbox')).toHaveValue('second');
  });
});

describe('SearchBox submit button', () => {
  beforeEach(() => {
    renderAt('/search');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a submit button, not a click handler bolted to a div', () => {
    expect(screen.getByRole('button', { name: /search/i })).toHaveAttribute('type', 'submit');
  });

  it('meets the 44px touch target the rest of the app uses', () => {
    expect(screen.getByRole('button', { name: /search/i }).className).toContain('min-h-11');
  });
});
