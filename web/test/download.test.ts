import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadBlob, REVOKE_DELAY_MS } from '../src/calendar/download';

/**
 * These assertions exist because of a real iOS Safari failure: the previous
 * inline implementation clicked a detached anchor and revoked the object URL
 * in the same tick. Safari reads the blob asynchronously, so revoking
 * immediately can cancel the download before a single byte is written, and a
 * detached anchor's programmatic `click()` has historically been ignored.
 * Both are invisible on desktop Chrome, which is why they survived.
 */
describe('downloadBlob', () => {
  let createSpy: ReturnType<typeof vi.spyOn>;
  let revokeSpy: ReturnType<typeof vi.spyOn>;
  let clicked: { attached: boolean; download: string; href: string } | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    clicked = undefined;
    createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = {
        attached: document.body.contains(this),
        download: this.download,
        href: this.getAttribute('href') ?? '',
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clicks an anchor that is attached to the document', () => {
    downloadBlob(new Blob(['x'], { type: 'text/calendar' }), 'schedule.ics');
    expect(clicked?.attached).toBe(true);
  });

  it('carries the filename through the download attribute', () => {
    downloadBlob(new Blob(['x'], { type: 'text/calendar' }), 'schedule.ics');
    expect(clicked?.download).toBe('schedule.ics');
    expect(clicked?.href).toBe('blob:mock');
  });

  it('has not revoked the object URL by the time click() returns', () => {
    downloadBlob(new Blob(['x'], { type: 'text/calendar' }), 'schedule.ics');
    expect(createSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it('revokes the object URL once the browser has had time to read the blob', () => {
    downloadBlob(new Blob(['x'], { type: 'text/calendar' }), 'schedule.ics');
    vi.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
  });

  it('leaves no anchor behind in the document', () => {
    downloadBlob(new Blob(['x'], { type: 'text/calendar' }), 'schedule.ics');
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
