import type { ReactNode } from 'react';
import { Box, List, ListItem, Typography } from '@mui/material';
import type {
  CalloutBlock, CalloutVariant, HeadingBlock, HeadingLevel, ImageBlock,
  ListBlock, RowBlock, RowChildBlock, TextBlock, VideoBlock,
} from '../types';
import { blockLayoutSx, layoutOf } from './utils';

export type PresentationalBlock =
  | HeadingBlock | TextBlock | ImageBlock | VideoBlock | ListBlock | CalloutBlock | RowBlock;

const HEADING_VARIANT: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'h4'> = {
  1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4',
};

const CALLOUT_COLORS: Record<CalloutVariant, { bg: string; fg: string; border: string }> = {
  info:    { bg: '#EFF6FF', fg: '#1E3A8A', border: '#BFDBFE' },
  warning: { bg: '#FFFBEB', fg: '#854D0E', border: '#FDE68A' },
  success: { bg: '#F0FDF4', fg: '#14532D', border: '#BBF7D0' },
  note:    { bg: '#F8FAFC', fg: '#0F172A', border: '#E2E8F0' },
};

// Shared renderer for all content blocks (staff view + both editor previews).
export function renderBlockContent(
  block: PresentationalBlock,
  renderChild: (child: RowChildBlock) => ReactNode = renderBlockContent,
): ReactNode {
  switch (block.type) {
    case 'heading':
      return (
        <Typography
          variant={HEADING_VARIANT[block.data.level]}
          component={`h${block.data.level}`}
          sx={[blockLayoutSx(block.layout), { textAlign: block.textAlign ?? 'left' }]}
        >
          {block.data.text}
        </Typography>
      );

    case 'text':
      return (
        <Box
          sx={[
            { color: 'text.primary', lineHeight: 1.7, '& p': { margin: 0 }, '& p + p': { mt: 1.5 }, '& img': { maxWidth: '100%', height: 'auto' } },
            blockLayoutSx(block.layout),
            { textAlign: block.textAlign ?? 'left' },
          ]}
          dangerouslySetInnerHTML={{ __html: block.data.html }}
        />
      );

    case 'image': {
      const layout = layoutOf(block);
      const width = layout?.width;
      return (
        <Box component="figure" sx={{ m: 0, textAlign: layout?.align ?? 'left' }}>
          <Box
            component="img"
            src={block.data.url}
            alt={block.data.alt}
            sx={{ display: 'inline-block', height: 'auto', maxWidth: '100%', borderRadius: 1.5, ...(width && width < 100 ? { width: { sm: `${width}%` } } : null) }}
          />
          {block.data.caption && (
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {block.data.caption}
            </Typography>
          )}
        </Box>
      );
    }

    case 'video': {
      const width = block.layout?.width;
      return (
        <Box component="figure" sx={{ m: 0, textAlign: block.layout?.align ?? 'left' }}>
          <Box
            component="video"
            src={block.data.url}
            controls
            sx={{ display: 'inline-block', maxWidth: '100%', height: 'auto', borderRadius: 1.5, ...(width && width < 100 ? { width: { sm: `${width}%` } } : null) }}
          />
          {block.data.caption && (
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {block.data.caption}
            </Typography>
          )}
        </Box>
      );
    }

    case 'list': {
      const ordered = block.data.style === 'ordered';
      return (
        <List
          component={ordered ? 'ol' : 'ul'}
          sx={[
            { listStyleType: ordered ? 'decimal' : 'disc', pl: 3, py: 0, '& .MuiListItem-root': { display: 'list-item', px: 0, py: 0.25 } },
            blockLayoutSx(block.layout),
          ]}
        >
          {block.data.items.filter(Boolean).map((item, i) => (
            <ListItem key={i} disableGutters>
              <Typography variant="body1">{item}</Typography>
            </ListItem>
          ))}
        </List>
      );
    }

    case 'callout': {
      const colors = CALLOUT_COLORS[block.data.variant];
      return (
        <Box
          component="aside"
          sx={[
            { bgcolor: colors.bg, color: colors.fg, border: '1px solid', borderColor: colors.border, borderRadius: 2.5, p: 2 },
            blockLayoutSx(block.layout),
          ]}
        >
          {block.data.title && (
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{block.data.title}</Typography>
          )}
          {block.data.body && <Typography sx={{ color: 'inherit' }}>{block.data.body}</Typography>}
        </Box>
      );
    }

    case 'row':
      return (
        <Box
          sx={[
            { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${block.data.columns}, 1fr)` }, gap: 2 },
            blockLayoutSx(block.layout),
          ]}
        >
          {block.data.children.map((placed) => (
            <Box
              key={placed.block.id}
              sx={{ gridColumn: { xs: 'auto', sm: `${placed.colStart} / span ${placed.colSpan}` }, minWidth: 0 }}
            >
              {renderChild(placed.block)}
            </Box>
          ))}
        </Box>
      );

    default:
      return null;
  }
}
