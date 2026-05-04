import { useState } from 'react';
import type { Block, BlockType } from '../types';
import { createBlock, BLOCK_LABELS } from './utils';
import HeadingBlockEditor    from './editors/HeadingBlockEditor';
import TextBlockEditor       from './editors/TextBlockEditor';
import ImageBlockEditor      from './editors/ImageBlockEditor';
import VideoBlockEditor      from './editors/VideoBlockEditor';
import ListBlockEditor       from './editors/ListBlockEditor';
import MultipleChoiceEditor  from './editors/MultipleChoiceEditor';
import TrueFalseEditor       from './editors/TrueFalseEditor';

const BLOCK_TYPES: BlockType[] = ['heading', 'text', 'image', 'video', 'list', 'multiple_choice', 'true_false'];

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function BlockEditor({ blocks, onChange }: Props) {
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);

  function updateBlock(index: number, data: Block['data']) {
    const updated = [...blocks];
    updated[index] = { ...updated[index], data } as Block;
    onChange(updated);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  }

  function insertBlock(type: BlockType, atIndex: number) {
    const newBlock = createBlock(type);
    const updated = [...blocks];
    updated.splice(atIndex, 0, newBlock);
    onChange(updated);
    setAddMenuIndex(null);
  }

  function renderEditor(block: Block, index: number) {
    switch (block.type) {
      case 'heading':
        return <HeadingBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'text':
        return <TextBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'image':
        return <ImageBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'video':
        return <VideoBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'list':
        return <ListBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'multiple_choice':
        return <MultipleChoiceEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'true_false':
        return <TrueFalseEditor block={block} onChange={(data) => updateBlock(index, data)} />;
    }
  }

  return (
    <div>
      {blocks.length === 0 && <p>No blocks yet. Add one below.</p>}

      {blocks.map((block, index) => (
        <div
          key={block.id}
          style={{ border: '1px solid #ccc', padding: '0.75rem', marginBottom: '0.5rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <strong>{BLOCK_LABELS[block.type]}</strong>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0}>↑</button>
              <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>↓</button>
              <button type="button" onClick={() => removeBlock(index)}>Delete</button>
            </div>
          </div>
          {renderEditor(block, index)}
        </div>
      ))}

      <div style={{ marginTop: '0.5rem' }}>
        {addMenuIndex === null ? (
          <button type="button" onClick={() => setAddMenuIndex(blocks.length)}>
            + Add block
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {BLOCK_TYPES.map((type) => (
              <button key={type} type="button" onClick={() => insertBlock(type, addMenuIndex)}>
                {BLOCK_LABELS[type]}
              </button>
            ))}
            <button type="button" onClick={() => setAddMenuIndex(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
