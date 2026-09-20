import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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

function renderApp() {
  render(<MemoryRouter><StoreProvider><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/search" element={<SearchResults />} />
  </Routes></StoreProvider></MemoryRouter>);
}

it('stays on Home while you type, and only searches when you submit', () => {
  renderApp();
  const input = screen.getByRole('searchbox') as HTMLInputElement;

  fireEvent.change(input, { target: { value: 'segment' } });
  expect(screen.getByRole('heading', { level: 1, name: /miccai subscribe/i })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /search results/i })).not.toBeInTheDocument();

  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('heading', { name: /search results/i })).toBeInTheDocument();
});

it('carries the query into the search page box, so it can be edited and resubmitted', () => {
  renderApp();
  const input = screen.getByRole('searchbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'segment' } });
  fireEvent.submit(input.closest('form')!);

  const next = screen.getByRole('searchbox') as HTMLInputElement;
  expect(next).toHaveValue('segment');

  fireEvent.change(next, { target: { value: 'segmentation' } });
  fireEvent.submit(next.closest('form')!);
  expect(screen.getByRole('searchbox')).toHaveValue('segmentation');
});

it('does not steal focus back into the box on arrival, which would cover the results with the keyboard', () => {
  renderApp();
  const input = screen.getByRole('searchbox') as HTMLInputElement;
  input.focus();
  fireEvent.change(input, { target: { value: 'segment' } });
  fireEvent.submit(input.closest('form')!);

  expect(screen.getByRole('searchbox')).not.toHaveFocus();
});
