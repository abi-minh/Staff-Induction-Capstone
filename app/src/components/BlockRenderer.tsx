import {
  Alert, Box, FormControlLabel, Paper, Radio, RadioGroup, TextField, Typography,
} from '@mui/material';
import type { Block, ImageSource } from '../types';
import { renderBlockContent } from '../blocks/renderContent';
import ZoomableImage from './ZoomableImage';

interface Props {
  blocks: Block[];
  answers: Record<string, string>;
  onAnswer: (blockId: string, answer: string) => void;
  showResults: Record<string, boolean> | null;
  disabled?: boolean;
  /** Responsive sources keyed by attachment id, straight from the module. */
  imageSources?: Record<string, ImageSource>;
}

export default function BlockRenderer({ blocks, answers, onAnswer, showResults, disabled, imageSources }: Props) {
  return (
    <Box>
      {blocks.map((block) => (
        <Box key={block.id} sx={{ mb: 2.5 }}>
          {renderBlock(block, answers, onAnswer, showResults, disabled ?? false, imageSources)}
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
  imageSources?: Record<string, ImageSource>,
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
            <ZoomableImage
              src={block.data.imageUrl}
              alt=""
              srcSet={imageSources?.[String(block.data.imageMediaId)]?.srcset}
              sizes={imageSources?.[String(block.data.imageMediaId)]?.sizes}
              enabled
              wrapperSx={{ display: 'inline-block', maxWidth: '100%', mb: 1.5 }}
              // Capped at 320px inline, which is exactly why these need to
              // open: a question's diagram is often unreadable at that size.
              imgSx={{ width: 'auto', maxWidth: '100%', maxHeight: 320, borderRadius: 1.5 }}
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
      // Staff-facing only (StaffModuleViewPage is the sole caller), so this
      // is the safe place to turn image zoom on without affecting the editor.
      return renderBlockContent(block, undefined, { zoomImages: true, imageSources });
  }
}
