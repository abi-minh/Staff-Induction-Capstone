import type { ListBlock, ListStyle } from '../../types';

interface Props {
  block: ListBlock;
  onChange: (data: ListBlock['data']) => void;
}

export default function ListBlockEditor({ block, onChange }: Props) {
  function updateItem(index: number, value: string) {
    const items = [...block.data.items];
    items[index] = value;
    onChange({ ...block.data, items });
  }

  function addItem() {
    onChange({ ...block.data, items: [...block.data.items, ''] });
  }

  function removeItem(index: number) {
    if (block.data.items.length <= 1) return;
    onChange({ ...block.data, items: block.data.items.filter((_, i) => i !== index) });
  }

  return (
    <div>
      <select
        value={block.data.style}
        onChange={(e) => onChange({ ...block.data, style: e.target.value as ListStyle })}
      >
        <option value="unordered">Bullet list</option>
        <option value="ordered">Numbered list</option>
      </select>

      <div>
        {block.data.items.map((item, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
            <span>{block.data.style === 'ordered' ? `${index + 1}.` : '•'}</span>
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder="List item…"
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => removeItem(index)} disabled={block.data.items.length <= 1}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem}>+ Add item</button>
      </div>
    </div>
  );
}
