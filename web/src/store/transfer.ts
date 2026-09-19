import { sanitize, type StoredState } from './storage';

/** RFC 4648 §5: standard base64's `+`/`/` and `=` padding aren't URL/fragment-safe. */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return b64 + pad;
}

/**
 * `btoa`/`atob` only operate on Latin1 (one byte per char), so a state
 * containing non-ASCII author names would corrupt going straight through
 * them. Route through TextEncoder/TextDecoder's UTF-8 bytes instead, each
 * byte mapped to one Latin1 char for btoa/atob to carry losslessly.
 */
function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return binary;
}

function binaryStringToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encodes state as a URL-fragment-safe string: JSON -> UTF-8 -> base64url. */
export function encodeTransfer(state: StoredState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(btoa(bytesToBinaryString(bytes)));
}

/**
 * Reverses `encodeTransfer` and validates the result through the same field
 * sanitizer `loadState` uses, so a transfer string can never grant fields a
 * local load would reject (e.g. a future/unknown schema version). Never
 * throws: any failure at any step (bad base64, invalid UTF-8, invalid JSON,
 * failed sanitization) yields `null`.
 */
export function decodeTransfer(s: string): StoredState | null {
  if (!s) return null;
  try {
    const binary = atob(fromBase64Url(s));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(binaryStringToBytes(binary));
    const parsed: unknown = JSON.parse(json);
    return sanitize(parsed);
  } catch {
    return null;
  }
}
