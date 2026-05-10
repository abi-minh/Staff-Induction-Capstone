import type { Block } from '../types';

interface Props {
  blocks: Block[];
  answers: Record<string, string>;
  onAnswer: (blockId: string, answer: string) => void;
  showResults: Record<string, boolean> | null;
}

export default function BlockRenderer({ blocks, answers, onAnswer, showResults }: Props) {
  return (
    <div>
      {blocks.map((block) => (
        <div key={block.id} style={{ marginBottom: '1rem' }}>
          {renderBlock(block, answers, onAnswer, showResults)}
        </div>
      ))}
    </div>
  );
}

function renderBlock(
  block: Block,
  answers: Record<string, string>,
  onAnswer: (blockId: string, answer: string) => void,
  showResults: Record<string, boolean> | null,
) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.data.level}` as keyof JSX.IntrinsicElements;
      return <Tag>{block.data.text}</Tag>;
    }
    case 'text':
      return <div dangerouslySetInnerHTML={{ __html: block.data.html }} />;
    case 'image':
      return (
        <figure style={{ margin: 0 }}>
          <img
            src={block.data.url}
            alt={block.data.alt}
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
          {block.data.caption && <figcaption>{block.data.caption}</figcaption>}
        </figure>
      );
    case 'video':
      return (
        <figure style={{ margin: 0 }}>
          <video
            src={block.data.url}
            controls
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
          {block.data.caption && <figcaption>{block.data.caption}</figcaption>}
        </figure>
      );
    case 'list': {
      const Tag = block.data.style === 'ordered' ? 'ol' : 'ul';
      return (
        <Tag>
          {block.data.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      );
    }
    case 'callout': {
      const palette: Record<typeof block.data.variant, { bg: string; fg: string; border: string }> = {
        info:    { bg: '#EFF6FF', fg: '#1E3A8A', border: '#BFDBFE' },
        warning: { bg: '#FFFBEB', fg: '#854D0E', border: '#FDE68A' },
        success: { bg: '#F0FDF4', fg: '#14532D', border: '#BBF7D0' },
        note:    { bg: '#F8FAFC', fg: '#0F172A', border: '#E2E8F0' },
      };
      const colors = palette[block.data.variant];
      return (
        <aside
          style={{
            background: colors.bg,
            color: colors.fg,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: '0.75rem 1rem',
          }}
        >
          {block.data.title && (
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{block.data.title}</div>
          )}
          <div>{block.data.body}</div>
        </aside>
      );
    }
    case 'row': {
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${block.data.columns}, 1fr)`,
            gap: '1rem',
          }}
        >
          {block.data.children.map((placed) => (
            <div
              key={placed.block.id}
              style={{ gridColumn: `${placed.colStart} / span ${placed.colSpan}` }}
            >
              {renderBlock(placed.block, answers, onAnswer, showResults)}
            </div>
          ))}
        </div>
      );
    }
    case 'multiple_choice': {
      const selectedAnswer = answers[block.id] ?? null;
      const questionResult = showResults?.[block.id];
      const isAnswered = questionResult !== undefined;
      return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: 8 }}>
          <p><strong>{block.data.question}</strong></p>
          {block.data.options.map((option, i) => (
            <label key={i} style={{ display: 'block', marginBottom: '0.25rem' }}>
              <input
                type="radio"
                name={`quiz-${block.id}`}
                checked={selectedAnswer === String(i)}
                onChange={() => onAnswer(block.id, String(i))}
                disabled={isAnswered}
              />
              {' '}{option}
            </label>
          ))}
          {isAnswered && (
            <p style={{ color: questionResult ? 'green' : 'red' }}>
              {questionResult ? 'Correct!' : 'Incorrect.'}
              {block.data.explanation && ` ${block.data.explanation}`}
            </p>
          )}
        </div>
      );
    }
    case 'true_false': {
      const selectedAnswer = answers[block.id] ?? null;
      const questionResult = showResults?.[block.id];
      const isAnswered = questionResult !== undefined;
      return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: 8 }}>
          <p><strong>{block.data.question}</strong></p>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            <input
              type="radio"
              name={`quiz-${block.id}`}
              checked={selectedAnswer === 'true'}
              onChange={() => onAnswer(block.id, 'true')}
              disabled={isAnswered}
            />
            {' '}True
          </label>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            <input
              type="radio"
              name={`quiz-${block.id}`}
              checked={selectedAnswer === 'false'}
              onChange={() => onAnswer(block.id, 'false')}
              disabled={isAnswered}
            />
            {' '}False
          </label>
          {isAnswered && (
            <p style={{ color: questionResult ? 'green' : 'red' }}>
              {questionResult ? 'Correct!' : 'Incorrect.'}
              {block.data.explanation && ` ${block.data.explanation}`}
            </p>
          )}
        </div>
      );
    }
  }
}
