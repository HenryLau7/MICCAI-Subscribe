import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoreProvider, useStore } from '../src/store/StoreProvider';
import { STORAGE_KEY } from '../src/store/storage';

beforeEach(() => localStorage.clear());

function Probe() {
  const { state, isBookmarked, toggleBookmark } = useStore();
  return (
    <div>
      <span data-testid="count">{state.bookmarks.length}</span>
      <span data-testid="has">{isBookmarked('M-PM-001') ? 'yes' : 'no'}</span>
      <button onClick={() => toggleBookmark('M-PM-001')}>toggle</button>
    </div>
  );
}

describe('StoreProvider', () => {
  it('round-trips a bookmark toggle through the probe component', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByTestId('has').textContent).toBe('no');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('has').textContent).toBe('yes');
    expect(screen.getByTestId('count').textContent).toBe('1');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('has').textContent).toBe('no');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('persists the toggle to localStorage immediately', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText('toggle'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(stored.bookmarks).toEqual(['M-PM-001']);
  });

  it('throws a clear error when useStore is called outside a StoreProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/StoreProvider/);
    spy.mockRestore();
  });
});
