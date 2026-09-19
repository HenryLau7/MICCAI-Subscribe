import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// This project doesn't set `test.globals: true`, so RTL's own auto-cleanup
// (which relies on a global `afterEach`) never registers. Without this, DOM
// nodes from one test's render() leak into the next test in the same file.
afterEach(() => cleanup());
