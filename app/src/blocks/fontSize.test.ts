import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FONT_SIZE, FONT_SIZES, fontSizeClass, fontSizeSx,
} from './fontSize';

describe('FONT_SIZES', () => {
  it('offers the four steps the client asked for', () => {
    expect(FONT_SIZES.map((s) => s.label)).to.deep.eq([
      'Small', 'Normal', 'Large', 'Extra large',
    ]);
  });

  it('has Normal at exactly the surrounding size', () => {
    const normal = FONT_SIZES.find((s) => s.key === DEFAULT_FONT_SIZE);
    expect(normal?.em, 'normal must not resize anything').to.eq(1);
  });

  it('orders the steps smallest to largest', () => {
    const ems = FONT_SIZES.map((s) => s.em);
    expect([...ems].sort((a, b) => a - b), 'the dropdown reads in order').to.deep.eq(ems);
  });

  // em, not px: the steps have to scale with whatever the theme sets for the
  // surrounding text, or a size chosen on a desktop is a different thing on a
  // phone — which is where most of this content is read.
  it('expresses every step relative to the surrounding text', () => {
    for (const [selector, rule] of Object.entries(fontSizeSx())) {
      expect(rule.fontSize, selector).to.match(/em$/);
    }
  });
});

describe('fontSizeSx', () => {
  it('emits a rule for every step except Normal', () => {
    const selectors = Object.keys(fontSizeSx());
    expect(selectors).to.have.length(FONT_SIZES.length - 1);
    expect(selectors).to.deep.eq([
      '& .ind-size-sm',
      '& .ind-size-lg',
      '& .ind-size-xl',
    ]);
  });

  // Normal is the absence of the mark. A class for it would mean two ways to
  // say the same thing, and text that still carries a span after an author
  // has set it back.
  it('gives Normal no class of its own', () => {
    expect(Object.keys(fontSizeSx())).to.not.include(`& .${fontSizeClass('normal')}`);
  });

  it('maps each class to its step', () => {
    expect(fontSizeSx()['& .ind-size-lg'].fontSize).to.eq('1.25em');
    expect(fontSizeSx()['& .ind-size-sm'].fontSize).to.eq('0.85em');
  });
});
