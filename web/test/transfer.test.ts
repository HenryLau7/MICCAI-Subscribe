import { describe, it, expect } from 'vitest';
import { defaultState, SCHEMA } from '../src/store/storage';
import { encodeTransfer, decodeTransfer } from '../src/store/transfer';

describe('cross-device transfer', () => {
  it('round-trips a state through a URL-safe string', () => {
    const s = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-042:oral'], followedAuthors: ['yuan-xue'] };
    const decoded = decodeTransfer(encodeTransfer(s));
    expect(decoded?.bookmarks).toEqual(s.bookmarks);
    expect(decoded?.followedAuthors).toEqual(['yuan-xue']);
  });

  it('produces a string safe to put in a URL fragment', () => {
    const encoded = encodeTransfer({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns null for garbage rather than throwing', () => {
    expect(decodeTransfer('!!!not-base64!!!')).toBeNull();
    expect(decodeTransfer('')).toBeNull();
  });

  it('round-trips non-ASCII bookmark/author data without corruption', () => {
    // TextEncoder/btoa path over a Latin1-only binary string would mangle
    // multi-byte UTF-8 if the encode/decode weren't symmetric — exercise it
    // with real non-ASCII content rather than only ASCII ids.
    const s = { ...defaultState(), followedAuthors: ['josé-garcía', '张三'] };
    const decoded = decodeTransfer(encodeTransfer(s));
    expect(decoded?.followedAuthors).toEqual(['josé-garcía', '张三']);
  });

  it('rejects a transfer string produced by a different schema version', () => {
    // A same-shaped payload but a bumped schema version must not be silently
    // accepted — that's exactly the case sanitize()'s `o.v !== SCHEMA` guard
    // exists for, shared between loadState and decodeTransfer.
    const bogus = { ...defaultState(), v: SCHEMA + 1, bookmarks: ['M-PM-001'] };
    const json = JSON.stringify(bogus);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeTransfer(encoded)).toBeNull();
  });

  it('does not throw on a well-formed base64url string that decodes to non-JSON', () => {
    const encoded = btoa('not json at all').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeTransfer(encoded)).toBeNull();
  });
});
