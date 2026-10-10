import { useState } from 'react';
import type { ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Box, Button, Divider, IconButton, MenuItem, OutlinedInput, Paper, Popover, Select,
  ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import AddLinkIcon from '@mui/icons-material/AddLink';
import CodeIcon from '@mui/icons-material/Code';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import type { BlockAlign } from '../../types';
import { alignedListSx } from '../utils';
import { DEFAULT_FONT_SIZE, FONT_SIZES, fontSizeSx } from '../fontSize';
import { FontSizeMark } from './FontSizeMark';

// Paste is left to ProseMirror.
//
// There used to be a transformPastedHTML hook here that stripped attributes off
// pasted markup — and, for a while, reduced pastes to plain text — on the theory
// that Word/OneNote's style="..." cruft was what made module saves fail. It
// wasn't. The real cause was update_post_meta() unslashing the JSON payload and
// breaking it on any escaped quote (see induction_slash_meta() in the plugin).
// With that fixed there's nothing to defend against here, and ProseMirror
// already drops anything its schema can't represent — inline styles included —
// so a plain paste keeps the formatting that survives (bold, italic, lists,
// links) and discards the rest on its own.

interface Props {
  /** Initial HTML. Read once, on mount, as ProseMirror owns the value after that. */
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Alignment of the editing surface, so what is typed looks like what is read. */
  textAlign?: BlockAlign;
  /** Height of the typing area. A callout body is usually a sentence or two. */
  minHeight?: number;
  /** Extra toolbar controls, shown after a divider — alignment, for instance. */
  toolbarExtras?: ReactNode;
}

/**
 * The rich text surface behind both the text block and the callout body.
 *
 * Shared rather than copied: the toolbar, the ProseMirror schema and the
 * styling of lists and code have to agree between the two, and the list
 * alignment rules alone have already been fixed twice. One of them drifting
 * would mean a callout that accepts formatting the reader cannot see.
 */
export default function RichTextField({
  html, onChange, placeholder = 'Start typing...', textAlign, minHeight = 80, toolbarExtras,
}: Props) {
  const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      FontSizeMark,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: html,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const isLinkActive = editor.isActive('link');
  // The size of the selection, or of the cursor position when nothing is
  // selected — which is what a new keystroke would inherit.
  const activeFontSize: string = editor.getAttributes('fontSize').size ?? DEFAULT_FONT_SIZE;

  function applyFontSize(size: string) {
    const chain = editor!.chain().focus();
    // Normal is the absence of the mark rather than a size of its own, so
    // there is nothing left on the text once an author goes back to it.
    if (size === DEFAULT_FONT_SIZE) {
      chain.unsetMark('fontSize').run();
    } else {
      chain.setMark('fontSize', { size }).run();
    }
  }

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

        {/* Text size. Four named steps, not a point size — see fontSize.ts.
            No tooltip, unlike the icon buttons either side: this control shows
            its current value, so a label adds nothing — and the tooltip opened
            on top of the menu, hiding the first option. */}
        <Select
          size="small"
          value={activeFontSize}
          onChange={(e) => applyFontSize(e.target.value)}
          inputProps={{ 'aria-label': 'Text size' }}
          sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: '0.8125rem' }, minWidth: 104 }}
        >
          {FONT_SIZES.map((size) => (
            <MenuItem key={size.key} value={size.key} sx={{ fontSize: '0.875rem' }}>
              {size.label}
            </MenuItem>
          ))}
        </Select>

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

        {toolbarExtras && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            {toolbarExtras}
          </>
        )}
      </Box>

      {/* Editor area */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          textAlign: textAlign ?? 'left',
          '& .ProseMirror': {
            outline: 'none',
            minHeight,
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            '& > p': { my: 0.5 },
            '& ul, & ol': { pl: 3, my: 0.5, ...alignedListSx(textAlign) },
            '& li > p': { my: 0 },
            '& code': {
              bgcolor: 'grey.100',
              px: 0.5,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            },
            '& a': { color: 'primary.main' },
            ...fontSizeSx(),
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
