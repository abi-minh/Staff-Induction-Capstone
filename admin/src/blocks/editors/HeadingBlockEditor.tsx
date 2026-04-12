import type { HeadingBlock, HeadingLevel } from '../../types';

interface Props {
  block: HeadingBlock;
  onChange: (data: HeadingBlock['data']) => void;
}

export default function HeadingBlockEditor({ block, onChange }: Props) {
  return (
    <div>
      <select
        value={block.data.level}
        onChange={(e) => onChange({ ...block.data, level: Number(e.target.value) as HeadingLevel })}
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
        <option value={4}>H4</option>
      </select>
      <input
        type="text"
        value={block.data.text}
        onChange={(e) => onChange({ ...block.data, text: e.target.value })}
        placeholder="Heading text…"
      />
    </div>
  );
}
