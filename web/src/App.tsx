import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './store/StoreProvider';
import { ProgramProvider } from './ui/ProgramContext';
import { BottomNav } from './ui/BottomNav';
import { Footer } from './ui/Footer';
import { Home } from './routes/Home';
import { SearchResults } from './routes/SearchResults';
import { About } from './routes/About';

/** Placeholder for routes another task will build out; keeps bottom-nav links from going blank. */
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-[var(--fg)]">{label}</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">This section isn&rsquo;t built yet — check back soon.</p>
    </div>
  );
}

function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--fg)]">
      <main className="flex-1 pb-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/schedule" element={<ComingSoon label="Schedule" />} />
          <Route path="/satellite" element={<ComingSoon label="Satellite events" />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<ComingSoon label="Not found" />} />
        </Routes>
        <Footer />
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ProgramProvider>
          <AppShell />
        </ProgramProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}

export default App;
