import type {
  CalloutBlock, HeadingBlock, ImageBlock, ListBlock, RowChildBlock,
  TextBlock, VideoBlock,
} from '../../../types';
import HeadingBlockEditor from '../HeadingBlockEditor';
import TextBlockEditor    from '../TextBlockEditor';
import ImageBlockEditor   from '../ImageBlockEditor';
import VideoBlockEditor   from '../VideoBlockEditor';
import ListBlockEditor    from '../ListBlockEditor';
import CalloutBlockEditor from '../CalloutBlockEditor';

// Type assertions are required because TypeScript can't narrow the onChange
// callback's parameter type alongside the discriminated union of block.
export function renderChildEditor(
  block:    RowChildBlock,
  onChange: (data: RowChildBlock['data']) => void,
) {
  switch (block.type) {
    case 'heading': return <HeadingBlockEditor block={block} onChange={onChange as (d: HeadingBlock['data']) => void} />;
    case 'text':    return <TextBlockEditor    block={block} onChange={onChange as (d: TextBlock['data']) => void} />;
    case 'image':   return <ImageBlockEditor   block={block} onChange={onChange as (d: ImageBlock['data']) => void} />;
    case 'video':   return <VideoBlockEditor   block={block} onChange={onChange as (d: VideoBlock['data']) => void} />;
    case 'list':    return <ListBlockEditor    block={block} onChange={onChange as (d: ListBlock['data']) => void} />;
    case 'callout': return <CalloutBlockEditor block={block} onChange={onChange as (d: CalloutBlock['data']) => void} />;
  }
}
