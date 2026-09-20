import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import raw from '../public/data/program.min.json';
import { loadProgram } from '../src/data/load';

const DATA_URL = '/data/program.min.json';

/** A minimal Response stand-in: only the members loadProgram()/revalidate() touch. */
function makeResponse(
  body: unknown,
  opts: { ok?: boolean; status?: number; jsonError?: boolean } = {},
) {
  const { ok = true, status = 200, jsonError = false } = opts;
  const response = {
    ok,
    status,
    json: async () => {
      if (jsonError) throw new SyntaxError('Unexpected token in JSON');
      return body;
    },
    clone: () => makeResponse(body, opts),
  };
  return response as unknown as Response;
}

/** A minimal Cache stand-in backed by a single entry for DATA_URL. */
function makeCache(initial?: Response) {
  let entry = initial;
  return {
    match: vi.fn(async () => entry),
    put: vi.fn(async (_url: string, res: Response) => {
      entry = res;
    }),
    delete: vi.fn(async () => {
      const had = entry !== undefined;
      entry = undefined;
      return had;
    }),
  };
}

describe('loadProgram', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['html', 'schema'])('keeps the last good offline cache after a successful %s response', async (kind) => {
    const cache = makeCache(makeResponse(raw));
    vi.stubGlobal('caches', { open: async () => cache });
    const invalid = kind === 'html'
      ? makeResponse(null, { jsonError: true })
      : makeResponse({ ...raw, meta: { ...raw.meta, schema_version: 999 } });
    fetchMock.mockResolvedValueOnce(invalid).mockRejectedValue(new Error('offline'));
    await loadProgram();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cache.put).not.toHaveBeenCalled();
    expect((await loadProgram()).papers).toHaveLength(raw.papers.length);
  });

  it('does not cache an invalid first network response', async () => {
    const cache = makeCache();
    vi.stubGlobal('caches', { open: async () => cache });
    fetchMock.mockResolvedValue(makeResponse(null, { jsonError: true }));
    await expect(loadProgram()).rejects.toThrow();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('falls back to the network when the cached bundle has an unsupported schema_version, and evicts the bad entry', async () => {
    const staleBundle = { ...raw, meta: { ...raw.meta, schema_version: 999 } };
    const cache = makeCache(makeResponse(staleBundle));
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    fetchMock.mockResolvedValue(makeResponse(raw));

    const program = await loadProgram();

    expect(program.papers).toHaveLength(1165);
    expect(fetchMock).toHaveBeenCalledWith(DATA_URL);
    expect(cache.delete).toHaveBeenCalledWith(DATA_URL);
  });

  it('falls back to the network when the cached body is malformed JSON', async () => {
    const cache = makeCache(makeResponse(null, { jsonError: true }));
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    fetchMock.mockResolvedValue(makeResponse(raw));

    const program = await loadProgram();

    expect(program.papers).toHaveLength(1165);
    expect(fetchMock).toHaveBeenCalledWith(DATA_URL);
    expect(cache.delete).toHaveBeenCalledWith(DATA_URL);
  });

  it('resolves from a valid cached bundle without a network fetch to produce the result', async () => {
    const cache = makeCache(makeResponse(raw));
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    // Background revalidation may still fire its own request; make sure it
    // doesn't hang the test or reject unhandled.
    fetchMock.mockResolvedValue(makeResponse(raw));

    const program = await loadProgram();

    expect(program.papers).toHaveLength(1165);
    // The blocking "fetch the program" call (single-arg) must not have been used;
    // only the fire-and-forget revalidation call (two args) may occur.
    expect(fetchMock).not.toHaveBeenCalledWith(DATA_URL);
  });

  it('falls back to plain fetch when there is no Cache Storage at all', async () => {
    vi.stubGlobal('caches', undefined);
    fetchMock.mockResolvedValue(makeResponse(raw));

    const program = await loadProgram();

    expect(program.papers).toHaveLength(1165);
    expect(fetchMock).toHaveBeenCalledWith(DATA_URL);
  });
});
