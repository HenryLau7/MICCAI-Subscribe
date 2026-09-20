import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './store/StoreProvider';
import { ProgramProvider } from './ui/ProgramContext';
import { BottomNav } from './ui/BottomNav';
import { Footer } from './ui/Footer';
import { Home } from './routes/Home';
import { SearchResults } from './routes/SearchResults';
import { About } from './routes/About';
import { PaperDetail } from './routes/PaperDetail';
import { AuthorDetail } from './routes/AuthorDetail';
import { AffiliationDetail } from './routes/AffiliationDetail';
import { SessionDetail } from './routes/SessionDetail';
import { Schedule } from './routes/Schedule';
import { Satellite } from './routes/Satellite';
import { SatelliteDetail } from './routes/SatelliteDetail';
import { CalendarPage } from './routes/CalendarPage';
import { ImportPage } from './routes/ImportPage';

/**
 * Every unknown path lands here, because _redirects rewrites /* to index.html
 * so the SPA can route. That means typos, stale links and misread QR codes all
 * arrive at this screen — it must say the page doesn't exist, never that the
 * app is unfinished.
 */
function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-[var(--fg)]">Page not found</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        That link doesn&rsquo;t match anything in the program. It may be mistyped, or point to an entry
        that has since changed.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--accent)] underline underline-offset-2"
      >
        Go to search
      </Link>
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
          <Route path="/paper/:id" element={<PaperDetail />} />
          <Route path="/author/:slug" element={<AuthorDetail />} />
          <Route path="/affiliation/:key" element={<AffiliationDetail />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/satellite" element={<Satellite />} />
          <Route path="/satellite/:id" element={<SatelliteDetail />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
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
