/**
 * Scroll whatever is actually scrolled back to the top.
 *
 * The staff layout gives `<main>` `overflow-y: auto` inside a 100vh shell, so
 * the window never scrolls and `window.scrollTo(0, 0)` does nothing — which is
 * why advancing a section left the reader half way down the next one.
 *
 * Rather than naming that element (and breaking the next time the layout
 * changes), this walks up from a node inside the view and resets every
 * ancestor that is actually scrolled. Resetting an ancestor at zero is a no-op,
 * so there is no need to work out which one is the scroller — and if a future
 * layout scrolls the window instead, the fallback covers it.
 */
export function scrollAncestorsToTop(from: Element | null | undefined): void {
  let scrolledSomething = false;

  for (let el = from?.parentElement; el; el = el.parentElement) {
    if (el.scrollTop > 0) {
      el.scrollTop = 0;
      scrolledSomething = true;
    }
  }

  if (!scrolledSomething) {
    // Guarded: jsdom and older Safari lack scrollTo on window.
    window.scrollTo?.({ top: 0 });
  }
}
