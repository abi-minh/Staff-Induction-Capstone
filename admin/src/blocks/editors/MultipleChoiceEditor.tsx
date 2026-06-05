import type { MultipleChoiceBlock } from '../../types';

interface Props {
  block: MultipleChoiceBlock;
  onChange: (data: MultipleChoiceBlock['data']) => void;
}

export default function MultipleChoiceEditor({ block, onChange }: Props) {
  function updateOption(index: number, value: string) {
    const options = [...block.data.options];
    options[index] = value;
    onChange({ ...block.data, options });
  }

  function addOption() {
    onChange({ ...block.data, options: [...block.data.options, ''] });
  }

  function removeOption(index: number) {
    if (block.data.options.length <= 2) return;
    const options = block.data.options.filter((_, i) => i !== index);
    const correctIndex = block.data.correctIndex >= options.length
      ? 0
      : block.data.correctIndex > index
        ? block.data.correctIndex - 1
        : block.data.correctIndex;
    onChange({ ...block.data, options, correctIndex });
  }

  return (
    <div>
      <input
        type="text"
        value={block.data.question}
        onChange={(e) => onChange({ ...block.data, question: e.target.value })}
        placeholder="Question…"
      />

      <div>
        {block.data.options.map((option, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem', alignItems: 'center' }}>
            <input
              type="radio"
              name={`correct-${block.id}`}
              checked={block.data.correctIndex === index}
              onChange={() => onChange({ ...block.data, correctIndex: index })}
              title="Mark as correct answer"
            />
            <input
              type="text"
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => removeOption(index)} disabled={block.data.options.length <= 2}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addOption}>+ Add option</button>
      </div>

      <input
        type="text"
        value={block.data.explanation}
        onChange={(e) => onChange({ ...block.data, explanation: e.target.value })}
        placeholder="Explanation (shown after submitting, optional)"
      />
    </div>
  );
}
