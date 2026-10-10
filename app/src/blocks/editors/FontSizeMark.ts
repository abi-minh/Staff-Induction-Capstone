import { Mark, mergeAttributes } from '@tiptap/core';
import { fontSizeClass } from '../fontSize';

/**
 * A text size applied to part of a paragraph.
 *
 * Deliberately written from scratch rather than built on TipTap's TextStyle
 * extension, which parses the `style` attribute. That matters because of how
 * paste behaves: ProseMirror drops anything its schema cannot represent, which
 * is the only reason a paste out of Word arrives clean today. Teach the schema
 * to read `style="font-size: …"` and the next pasted document silently brings
 * Calibri 11pt in with it, across every paragraph, with nothing on screen to
 * say so.
 *
 * This mark recognises one thing — a span carrying our own `data-size` — so a
 * pasted size from anywhere else is still discarded, and the only sizes in the
 * document are the four an author picked from the toolbar.
 */
export const FontSizeMark = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-size'),
        renderHTML: (attributes) =>
          attributes.size
            ? { 'data-size': attributes.size, class: fontSizeClass(attributes.size) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-size]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});
