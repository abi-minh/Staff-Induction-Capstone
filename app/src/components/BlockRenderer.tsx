import {
  Alert, Box, FormControlLabel, Paper, Radio, RadioGroup, TextField, Typography,
} from '@mui/material';
import type { Block } from '../types';
import { renderBlockContent } from '../blocks/renderContent';

interface Props {
  blocks: Block[];
  answers: Record<string, string>;
  onAnswer: (blockId: string, answer: string) => void;
  showResults: Record<string, boolean> | null;
  disabled?: boolean;
}

export default function BlockRenderer({ blocks, answers, onAnswer, showResults, disabled }: Props) {
  return (
    <Box>
      {blocks.map((block) => (
        <Box key={block.id} sx={{ mb: 2.5 }}>
          {renderBlock(block, answers, onAnswer, showResults, disabled ?? false)}
        </Box>
      ))}
    </Box>
  );
}

function renderBlock(
  block: Block,
  answers: Record<string, string>,
  onAnswer: (blockId: string, answer: string) => void,
  showResults: Record<string, boolean> | null,
  disabled: boolean,
) {
  switch (block.type) {
    case 'multiple_choice': {
      const selectedAnswer = answers[block.id] ?? null;
      const questionResult = showResults?.[block.id];
      const hasResult = questionResult !== undefined;
      return (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>{block.data.question}</Typography>
          {block.data.imageUrl && (
            <Box
              component="img"
              src={block.data.imageUrl}
              alt=""
              sx={{ display: 'block', maxWidth: '100%', maxHeight: 320, borderRadius: 1.5, mb: 1.5 }}
            />
          )}
          <RadioGroup
            value={selectedAnswer ?? ''}
            onChange={(e) => onAnswer(block.id, e.target.value)}
          >
            {block.data.options.map((option, i) => (
              <FormControlLabel
                key={i}
                value={String(i)}
                control={<Radio size="small" disabled={disabled} />}
                label={option}
                disabled={disabled}
              />
            ))}
          </RadioGroup>
          {hasResult && (
            <Alert severity={questionResult ? 'success' : 'error'} sx={{ mt: 1.5 }}>
              <strong>{questionResult ? 'Correct!' : 'Incorrect.'}</strong>
              {block.data.explanation && ` ${block.data.explanation}`}
            </Alert>
          )}
        </Paper>
      );
    }
    case 'true_false': {
      const selectedAnswer = answers[block.id] ?? null;
      const questionResult = showResults?.[block.id];
      const hasResult = questionResult !== undefined;
      return (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>{block.data.question}</Typography>
          <RadioGroup
            value={selectedAnswer ?? ''}
            onChange={(e) => onAnswer(block.id, e.target.value)}
          >
            <FormControlLabel value="true" control={<Radio size="small" disabled={disabled} />} label="True" disabled={disabled} />
            <FormControlLabel value="false" control={<Radio size="small" disabled={disabled} />} label="False" disabled={disabled} />
          </RadioGroup>
          {hasResult && (
            <Alert severity={questionResult ? 'success' : 'error'} sx={{ mt: 1.5 }}>
              <strong>{questionResult ? 'Correct!' : 'Incorrect.'}</strong>
              {block.data.explanation && ` ${block.data.explanation}`}
            </Alert>
          )}
        </Paper>
      );
    }
    case 'short_answer': {
      const currentAnswer = answers[block.id] ?? '';
      const questionResult = showResults?.[block.id];
      const hasResult = questionResult !== undefined;
      return (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>{block.data.question}</Typography>
          <TextField
            value={currentAnswer}
            onChange={(e) => onAnswer(block.id, e.target.value)}
            disabled={disabled}
            placeholder="Type your answer…"
            size="small"
            fullWidth
          />
          {hasResult && (
            <Alert severity={questionResult ? 'success' : 'error'} sx={{ mt: 1.5 }}>
              <strong>{questionResult ? 'Correct!' : 'Incorrect.'}</strong>
              {block.data.explanation && ` ${block.data.explanation}`}
            </Alert>
          )}
        </Paper>
      );
    }
    default:
      return renderBlockContent(block);
  }
}
