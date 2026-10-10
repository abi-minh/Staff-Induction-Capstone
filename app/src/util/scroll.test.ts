import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrollAncestorsToTop } from './scroll';

// jsdom does no layout, so scrollTop is just a settable number here. That is
// enough to prove the walk: these tests are about which ancestors get reset,
// not about whether a real browser can scroll them.

function nest(depth: number): HTMLElement[] {
  document.body.innerHTML = '';
  const chain: HTMLElement[] = [];
  let parent: HTMLElement = document.body;
  for (let i = 0; i < depth; i += 1) {
    const el = document.createElement('div');
    parent.appendChild(el);
    chain.push(el);
    parent = el;
  }
  return chain;
}

describe('scrollAncestorsToTop', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('resets a scrolled ancestor', () => {
    const [outer, , leaf] = nest(3);
    outer.scrollTop = 500;

    scrollAncestorsToTop(leaf);

    expect(outer.scrollTop).to.eq(0);
  });

  // Which ancestor scrolls is a layout decision that has already changed once;
  // resetting every scrolled one means this does not need to know.
  it('resets more than one when several are scrolled', () => {
    const [outer, middle, leaf] = nest(3);
    outer.scrollTop = 300;
    middle.scrollTop = 120;

    scrollAncestorsToTop(leaf);

    expect(outer.scrollTop).to.eq(0);
    expect(middle.scrollTop).to.eq(0);
  });

  it('does not touch the element it was given', () => {
    // Stubbed only to keep jsdom from logging "Not implemented: scrollTo";
    // nothing above the leaf is scrolled, so the fallback fires.
    vi.stubGlobal('scrollTo', vi.fn());
    const [, , leaf] = nest(3);
    leaf.scrollTop = 42;

    scrollAncestorsToTop(leaf);

    expect(leaf.scrollTop, 'the view root is not the scroller').to.eq(42);
  });

  // The fallback matters: if a later layout lets the window scroll instead of
  // a container, this still has to work.
  it('falls back to the window when nothing above is scrolled', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const [, , leaf] = nest(3);

    scrollAncestorsToTop(leaf);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('does not call the window fallback when a container was reset', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const [outer, , leaf] = nest(3);
    outer.scrollTop = 200;

    scrollAncestorsToTop(leaf);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  // Called from an effect, so the ref can legitimately be null on a branch
  // that has not mounted yet.
  it('tolerates null and undefined', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);

    expect(() => scrollAncestorsToTop(null)).to.not.throw();
    expect(() => scrollAncestorsToTop(undefined)).to.not.throw();
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});
