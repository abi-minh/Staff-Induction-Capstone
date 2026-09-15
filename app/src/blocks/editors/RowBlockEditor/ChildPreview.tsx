import { Typography } from '@mui/material';
import type { RowChildBlock } from '../../../types';
import { renderBlockContent } from '../../renderContent';

interface Props {
  block: RowChildBlock;
}

function placeholder(text: string) {
  return <Typography color="text.disabled" variant="body2">{text}</Typography>;
}

export default function ChildPreview({ block }: Props) {
  switch (block.type) {
    case 'heading':
      return block.data.text ? renderBlockContent(block) : placeholder('Heading…');
    case 'text':
      return block.data.html ? renderBlockContent(block) : placeholder('Text…');
    case 'image':
      return block.data.url ? renderBlockContent(block) : placeholder('No image');
    case 'video':
      return block.data.url ? renderBlockContent(block) : placeholder('No video');
    case 'list':
      return block.data.items.some(Boolean) ? renderBlockContent(block) : placeholder('List…');
    case 'callout':
      return block.data.body || block.data.title ? renderBlockContent(block) : placeholder('Callout…');
  }
}
