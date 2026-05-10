import { Box, Typography } from '@mui/material';
import type { RowChildBlock } from '../../../types';

interface Props {
  block: RowChildBlock;
}

export default function ChildPreview({ block }: Props) {
  switch (block.type) {
    case 'heading':
      return <Typography variant="body2" sx={{ fontWeight: 600 }}>{block.data.text || 'Heading…'}</Typography>;
    case 'text':
      return block.data.html
        ? <Box sx={{ '& p': { my: 0.5 } }} dangerouslySetInnerHTML={{ __html: block.data.html }} />
        : <Typography color="text.disabled" variant="body2">Text…</Typography>;
    case 'image':
      return block.data.url
        ? <Box component="img" src={block.data.url} alt={block.data.alt} sx={{ maxWidth: '100%', display: 'block' }} />
        : <Typography color="text.disabled" variant="body2">No image</Typography>;
    case 'video':
      return block.data.url
        ? <Box component="video" src={block.data.url} controls sx={{ maxWidth: '100%', display: 'block' }} />
        : <Typography color="text.disabled" variant="body2">No video</Typography>;
    case 'list': {
      const items = block.data.items.filter(Boolean);
      if (!items.length) return <Typography color="text.disabled" variant="body2">List…</Typography>;
      return (
        <Box component={block.data.style === 'ordered' ? 'ol' : 'ul'} sx={{ pl: 3, my: 0, '& li': { mb: 0.25 } }}>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </Box>
      );
    }
    case 'callout':
      return block.data.body || block.data.title
        ? (
          <Typography variant="body2">
            {block.data.title ? <strong>{block.data.title} </strong> : null}
            {block.data.body}
          </Typography>
        )
        : <Typography color="text.disabled" variant="body2">Callout…</Typography>;
  }
}
