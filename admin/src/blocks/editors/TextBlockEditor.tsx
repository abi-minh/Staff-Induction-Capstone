import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import type { TextBlock } from '../../types';

interface Props {
  block: TextBlock;
  onChange: (data: TextBlock['data']) => void;
}

export default function TextBlockEditor({ block, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start typing…' }),
    ],
    content: block.data.html,
    onUpdate: ({ editor }) => {
      onChange({ html: editor.getHTML() });
    },
  });

  if (!editor) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
          style={{ fontWeight: editor.isActive('bold') ? 'bold' : 'normal' }}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{ fontStyle: editor.isActive('italic') ? 'italic' : 'normal' }}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" onClick={() => {
          const url = window.prompt('URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}>Link</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
