import { describe, it, expect } from 'vitest';
import { decodeEntities, escapeHtml, stripHtml, truncate } from './strings';

// WordPress texturises titles and excerpts, so an apostrophe comes back from
// the REST API as a character reference. Every screen that shows one of those
// values as text rather than as markup went through stripHtml, which used to
// leave the reference alone — so a module banner read "do&#8217;s and
// don&#8217;ts" instead of "do's and don'ts".
describe('decodeEntities', () => {
  it('decodes the apostrophe wptexturize produces', () => {
    expect(decodeEntities('do&#8217;s and don&#8217;ts')).to.eq('do’s and don’ts');
  });

  it('decodes named entities too', () => {
    expect(decodeEntities('Health &amp; Safety')).to.eq('Health & Safety');
    expect(decodeEntities('rope &ndash; hazards')).to.eq('rope – hazards');
    expect(decodeEntities('wait&hellip;')).to.eq('wait…');
  });

  it('leaves text without references untouched', () => {
    expect(decodeEntities('Nothing to decode')).to.eq('Nothing to decode');
    expect(decodeEntities('')).to.eq('');
  });

  // A lone angle bracket is ordinary text in a safety note and has to survive.
  it('keeps a bare angle bracket', () => {
    expect(decodeEntities('keep load &lt; 20kg')).to.eq('keep load < 20kg');
  });
});

describe('stripHtml', () => {
  it('removes tags and decodes what is left', () => {
    expect(stripHtml('<p>do&#8217;s and don&#8217;ts</p>')).to.eq('do’s and don’ts');
  });

  // Tags become a space, so two blocks do not run into one word.
  it('does not join text across tags', () => {
    expect(stripHtml('<p>one</p><p>two</p>')).to.eq('one two');
  });

  it('collapses the whitespace it introduces', () => {
    expect(stripHtml('<p>  spaced   out  </p>')).to.eq('spaced out');
  });

  it('handles empty and tagless input', () => {
    expect(stripHtml('')).to.eq('');
    expect(stripHtml('just words')).to.eq('just words');
  });

  // Decoding happens after the tags are gone, so an escaped tag survives as
  // the text it was always meant to be rather than being stripped as markup.
  it('keeps an escaped tag as text', () => {
    expect(stripHtml('<p>use &lt;strong&gt; for emphasis</p>')).to.eq('use <strong> for emphasis');
  });
});

describe('escapeHtml', () => {
  it('escapes the characters that would otherwise be markup', () => {
    expect(escapeHtml('<b>"x" & y</b>')).to.eq('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Mind the rope.')).to.eq('Mind the rope.');
  });
});

describe('truncate', () => {
  it('leaves a short string alone', () => {
    expect(truncate('short', 10)).to.eq('short');
  });

  it('cuts to the limit, ellipsis included', () => {
    expect(truncate('abcdefghij', 5)).to.eq('abcd…');
    expect(truncate('abcdefghij', 5)).to.have.length(5);
  });
});
