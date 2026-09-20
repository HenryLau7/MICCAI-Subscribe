/**
 * Handing a generated file to the browser, the one way that also works on
 * iOS Safari.
 *
 * Two details here are load-bearing and look redundant on desktop Chrome:
 *
 * 1. The anchor is appended to the document before `click()`. Safari has
 *    historically ignored a programmatic click on a detached anchor carrying
 *    a `download` attribute.
 * 2. The object URL is revoked on a timer, not in the same tick as the
 *    click. Safari reads the blob asynchronously; revoking immediately can
 *    cancel the download before any bytes are written, which is how you end
 *    up with a missing or empty .ics that Calendar then refuses to import.
 */

/** Long enough for a slow device to have started reading the blob. */
export const REVOKE_DELAY_MS = 60_000;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
