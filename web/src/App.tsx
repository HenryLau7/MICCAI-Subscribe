import { useEffect, useState } from 'react';
import { loadProgram } from './data/load';
import type { Program } from './data/types';

function App() {
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProgram().then(setProgram).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  if (error) return <p>Failed to load program: {error}</p>;
  if (!program) return <p>Loading program…</p>;

  return (
    <div>
      <h1>{program.meta.conference}</h1>
      <p>Source revision: {program.meta.sourceRevision}</p>
      <ul>
        <li>Papers: {program.papers.length}</li>
        <li>Presentations: {program.presentations.length}</li>
        <li>Sessions: {program.sessions.size}</li>
        <li>Satellite events: {program.satellite.length}</li>
        <li>Authors: {program.authors.size}</li>
        <li>Affiliations: {program.affiliations.size}</li>
      </ul>
    </div>
  );
}

export default App;
