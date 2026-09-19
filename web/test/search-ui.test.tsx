import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaperCard } from '../src/ui/PaperCard';
import { StoreProvider } from '../src/store/StoreProvider';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);
const paper = program.byPaperId.get('M-PM-001')!;

describe('PaperCard', () => {
  it('shows enough to decide without opening the paper', () => {
    render(
      <MemoryRouter>
        <StoreProvider>
          <PaperCard program={program} paper={paper} />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(paper.title)).toBeInTheDocument();
    expect(screen.getByText(/Yuan Xue/)).toBeInTheDocument();
    expect(screen.getByText(/The Ohio State University/)).toBeInTheDocument();
    expect(screen.getByText('M-PM-001')).toBeInTheDocument();
  });

  it('exposes bookmark state through aria-pressed and toggles it', () => {
    render(
      <MemoryRouter>
        <StoreProvider>
          <PaperCard program={program} paper={paper} />
        </StoreProvider>
      </MemoryRouter>,
    );
    const btn = screen.getByRole('button', { name: /bookmark/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('never renders a fabricated poster hall', () => {
    render(
      <MemoryRouter>
        <StoreProvider>
          <PaperCard program={program} paper={paper} />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Poster Hall/i)).not.toBeInTheDocument();
  });
});
