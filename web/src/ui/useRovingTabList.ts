import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * Shared keyboard behavior for the ARIA APG Tabs pattern: a single tab stop
 * for the whole tablist (only the selected tab is in the Tab order), with
 * Left/Right/Home/End moving both focus and selection among the tabs.
 * Used by both Schedule's day tabs and Satellite's day tabs so the behavior
 * is implemented once rather than twice.
 *
 * `items` must be in the same left-to-right order they're rendered in —
 * ArrowRight/ArrowLeft step through that order and wrap at the ends.
 */
export function useRovingTabList<T>(items: readonly T[], selected: T, onSelect: (item: T) => void) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    event.preventDefault();
    onSelect(items[next]);
    // The target tab is already mounted (roving tabindex moves focus among
    // existing tabs, it doesn't create one) — tabIndex=-1 still accepts a
    // programmatic .focus() call, it's only excluded from the Tab order.
    tabRefs.current[next]?.focus();
  }

  /** Spread onto each tab button, keyed by its render-order index. */
  function tabProps(index: number) {
    return {
      ref: (el: HTMLButtonElement | null) => {
        tabRefs.current[index] = el;
      },
      tabIndex: items[index] === selected ? 0 : -1,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index),
    };
  }

  return { tabProps };
}
