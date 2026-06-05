import type { TrueFalseBlock } from '../../types';

interface Props {
  block: TrueFalseBlock;
  onChange: (data: TrueFalseBlock['data']) => void;
}

export default function TrueFalseEditor({ block, onChange }: Props) {
  return (
    <div>
      <input
        type="text"
        value={block.data.question}
        onChange={(e) => onChange({ ...block.data, question: e.target.value })}
        placeholder="Question…"
      />

      <div>
        <label>Correct answer: </label>
        <select
          value={block.data.correctAnswer ? 'true' : 'false'}
          onChange={(e) => onChange({ ...block.data, correctAnswer: e.target.value === 'true' })}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
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
