import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Box, Button, Divider, IconButton, OutlinedInput, Paper, Popover,
  ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import AddLinkIcon from '@mui/icons-material/AddLink';
import CodeIcon from '@mui/icons-material/Code';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import type { TextBlock } from '../../types';

interface Props {
  block: TextBlock;
  onChange: (data: TextBlock['data']) => void;
}

export default function TextBlockEditor({ block, onChange }: Props) {
  const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start typing...' }),
    ],
    content: block.data.html,
    onUpdate: ({ editor }) => {
      onChange({ html: editor.getHTML() });
    },
  });

  if (!editor) return null;

  const isLinkActive = editor.isActive('link');

  const activeInline = [
    editor.isActive('bold') && 'bold',
    editor.isActive('italic') && 'italic',
  ].filter(Boolean) as string[];

  const activeBlock = [
    editor.isActive('bulletList') && 'bulletList',
    editor.isActive('orderedList') && 'orderedList',
    editor.isActive('code') && 'code',
  ].filter(Boolean) as string[];

  function openLinkPopover(e: React.MouseEvent<HTMLElement>) {
    setLinkUrl(editor?.getAttributes('link').href ?? '');
    setLinkAnchor(e.currentTarget);
  }

  function applyLink() {
    if (linkUrl) editor?.chain().focus().setLink({ href: linkUrl }).run();
    setLinkAnchor(null);
  }

  function removeLink() {
    editor?.chain().focus().unsetLink().run();
    setLinkAnchor(null);
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
          flexWrap: 'wrap',
        }}
      >
        {/* Inline marks: Bold, Italic */}
        <ToggleButtonGroup size="small" value={activeInline}>
          <Tooltip title="Bold">
            <ToggleButton value="bold" onClick={() => editor.chain().focus().toggleBold().run()}>
              <FormatBoldIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Italic">
            <ToggleButton value="italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
              <FormatItalicIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Block formats: Lists, Code */}
        <ToggleButtonGroup size="small" value={activeBlock}>
          <Tooltip title="Bullet list">
            <ToggleButton value="bulletList" onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <FormatListBulletedIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Numbered list">
            <ToggleButton value="orderedList" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <FormatListNumberedIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Inline code">
            <ToggleButton value="code" onClick={() => editor.chain().focus().toggleCode().run()}>
              <CodeIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Link */}
        <Tooltip title={isLinkActive ? 'Edit / remove link' : 'Add link'}>
          <IconButton
            size="small"
            color={isLinkActive ? 'primary' : 'default'}
            onClick={openLinkPopover}
          >
            {isLinkActive
              ? <LinkOffIcon sx={{ fontSize: 16 }} />
              : <AddLinkIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Editor area */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          '& .ProseMirror': {
            outline: 'none',
            minHeight: 80,
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            '& > p': { my: 0.5 },
            '& ul, & ol': { pl: 3, my: 0.5 },
            '& li > p': { my: 0 },
            '& code': {
              bgcolor: 'grey.100',
              px: 0.5,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            },
            '& a': { color: 'primary.main' },
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            color: 'text.disabled',
            pointerEvents: 'none',
            float: 'left',
            height: 0,
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>

      {/* Link popover */}
      <Popover
        open={Boolean(linkAnchor)}
        anchorEl={linkAnchor}
        onClose={() => setLinkAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
          <OutlinedInput
            size="small"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }}
            sx={{ minWidth: 240 }}
            autoFocus
          />
          <Button size="small" variant="contained" onClick={applyLink}>
            Apply
          </Button>
          {isLinkActive && (
            <Button size="small" color="error" onClick={removeLink}>
              Remove
            </Button>
          )}
        </Box>
      </Popover>
    </Paper>
  );
}
