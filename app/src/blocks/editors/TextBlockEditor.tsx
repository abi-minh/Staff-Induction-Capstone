import type { BlockAlign, TextBlock } from '../../types';
import TextAlignControls from '../TextAlignControls';
import RichTextField from './RichTextField';

interface Props {
  block: TextBlock;
  onChange: (data: TextBlock['data']) => void;
  onTextAlignChange?: (align: BlockAlign) => void;
}

export default function TextBlockEditor({ block, onChange, onTextAlignChange }: Props) {
  return (
    <RichTextField
      html={block.data.html}
      onChange={(html) => onChange({ html })}
      textAlign={block.textAlign}
      toolbarExtras={
        onTextAlignChange && (
          <TextAlignControls value={block.textAlign} onChange={onTextAlignChange} />
        )
      }
    />
  );
}
