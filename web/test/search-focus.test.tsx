import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Home } from '../src/routes/Home';
import { SearchResults } from '../src/routes/SearchResults';
import { decodeProgram } from '../src/data/decode';
import { buildSearchIndex } from '../src/search/engine';
import { StoreProvider } from '../src/store/StoreProvider';
import raw from '../public/data/program.min.json';

vi.mock('../src/ui/ProgramContext', () => ({ useProgram: () => ({ program, index }) }));
const program = decodeProgram(raw as never);
const index = buildSearchIndex(program);
afterEach(() => vi.useRealTimers());

it('continues typing at the same cursor position after Home navigates to search', () => {
  vi.useFakeTimers();
  render(<MemoryRouter><StoreProvider><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/search" element={<SearchResults />} />
  </Routes></StoreProvider></MemoryRouter>);
  const input = screen.getByRole('searchbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'segment' } });
  input.setSelectionRange(3, 3);
  act(() => vi.advanceTimersByTime(300));
  const next = screen.getByRole('searchbox') as HTMLInputElement;
  expect(next).toHaveFocus();
  expect(next.selectionStart).toBe(3);
  fireEvent.change(next, { target: { value: 'segmentation' } });
  act(() => vi.advanceTimersByTime(300));
  expect(next).toHaveValue('segmentation');
});
