import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { FontSizeMark } from './FontSizeMark';

function editorWith(html: string): Editor {
  return new Editor({
    extensions: [StarterKit, FontSizeMark],
    content: html,
  });
}

function roundTrip(html: string): string {
  const editor = editorWith(html);
  const out = editor.getHTML();
  editor.destroy();
  return out;
}

describe('FontSizeMark', () => {
  it('keeps a size this editor wrote', () => {
    const out = roundTrip('<p>Mind the <span data-size="lg">rope</span>.</p>');
    expect(out).to.contain('data-size="lg"');
    expect(out, 'and tags it for the stylesheet').to.contain('ind-size-lg');
  });

  it('leaves unsized text alone', () => {
    expect(roundTrip('<p>Plain sentence.</p>')).to.eq('<p>Plain sentence.</p>');
  });

  // The reason this mark is hand-written rather than built on TextStyle.
  // ProseMirror drops what its schema cannot represent, and nothing here can
  // represent a style attribute — so a paste out of Word keeps its words and
  // loses its 11pt Calibri, which is the behaviour the editor has always had.
  it('discards a font size pasted from somewhere else', () => {
    const word = '<p><span style="font-size:11pt;font-family:Calibri">Pasted text</span></p>';
    const out = roundTrip(word);

    expect(out, 'the words survive').to.contain('Pasted text');
    expect(out, 'the foreign size does not').to.not.contain('font-size');
    expect(out).to.not.contain('Calibri');
    expect(out).to.not.contain('data-size');
  });

  it('survives a size it does not recognise without inventing a class', () => {
    const out = roundTrip('<p><span data-size="enormous">Shouty</span></p>');
    expect(out, 'the words survive whatever happens to the mark').to.contain('Shouty');
  });

  it('can mark a selection and take it back off again', () => {
    const editor = editorWith('<p>Mind the rope.</p>');

    editor.commands.selectAll();
    editor.commands.setMark('fontSize', { size: 'xl' });
    expect(editor.getHTML()).to.contain('data-size="xl"');

    editor.commands.unsetMark('fontSize');
    expect(editor.getHTML(), 'back to normal leaves no span behind')
      .to.eq('<p>Mind the rope.</p>');

    editor.destroy();
  });
});
