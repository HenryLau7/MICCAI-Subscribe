import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StoreProvider, useStore } from '../src/store/StoreProvider';
import { STORAGE_KEY, defaultState } from '../src/store/storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

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
  it('preserves another tab’s changes even before its storage event is delivered', () => {
    render(<StoreProvider><Probe /></StoreProvider>);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState(), bookmarks: ['M-PM-002'] }));
    fireEvent.click(screen.getByText('toggle'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).bookmarks).toEqual(['M-PM-002', 'M-PM-001']);
  });

  it('updates from storage events without writing a stale snapshot back', () => {
    render(<StoreProvider><Probe /></StoreProvider>);
    const text = JSON.stringify({ ...defaultState(), bookmarks: ['M-PM-001'] });
    localStorage.setItem(STORAGE_KEY, text);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: text, storageArea: localStorage })));
    expect(screen.getByTestId('has')).toHaveTextContent('yes');
    expect(writes).not.toHaveBeenCalled();
    localStorage.clear();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage })));
    expect(screen.getByTestId('has')).toHaveTextContent('no');
  });

  it('keeps in-memory edits when storage writes fail', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState(), bookmarks: ['M-PM-002'] }));
    render(<StrictMode><StoreProvider><Probe /></StoreProvider></StrictMode>);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('has')).toHaveTextContent('no');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('observes a cleared saved schedule before this tab makes its first edit', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState(), bookmarks: ['M-PM-002'] }));
    render(<StoreProvider><Probe /></StoreProvider>);
    localStorage.clear();
    fireEvent.click(screen.getByText('toggle'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).bookmarks).toEqual(['M-PM-001']);
  });

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
