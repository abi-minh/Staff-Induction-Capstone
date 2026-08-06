import {
  Alert, Box, FormControlLabel, List, ListItem, Paper, Radio, RadioGroup, Typography,
} from '@mui/material';
import type { Block, CalloutVariant, HeadingLevel } from '../types';

interface Props {
  blocks: Block[];
  answers: Record<string, string>;
  onAnswer: (blockId: string, answer: string) => void;
  showResults: Record<string, boolean> | null;
}

export default function BlockRenderer({ blocks, answers, onAnswer, showResults }: Props) {
  return (
    <Box>
      {blocks.map((block) => (
        <Box key={block.id} sx={{ mb: 2.5 }}>
          {renderBlock(block, answers, onAnswer, showResults)}
        </Box>
      ))}
    </Box>
  );
}

const HEADING_VARIANT: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'h4'> = {
  1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4',
};

const CALLOUT_COLORS: Record<CalloutVariant, { bg: string; fg: string; border: string }> = {
  info:    { bg: '#EFF6FF', fg: '#1E3A8A', border: '#BFDBFE' },
  warning: { bg: '#FFFBEB', fg: '#854D0E', border: '#FDE68A' },
  success: { bg: '#F0FDF4', fg: '#14532D', border: '#BBF7D0' },
  note:    { bg: '#F8FAFC', fg: '#0F172A', border: '#E2E8F0' },
};

function renderBlock(
  block: Block,
  answers: Record<string, string>,
  onAnswer: (blockId: string, answer: string) => void,
  showResults: Record<string, boolean> | null,
) {
  switch (block.type) {
    case 'heading': {
      const level = block.data.level;
      return (
        <Typography variant={HEADING_VARIANT[level]} component={`h${level}`}>
          {block.data.text}
        </Typography>
      );
    }
    case 'text':
      return (
        <Box
          sx={{ color: 'text.primary', lineHeight: 1.7, '& p': { margin: 0 }, '& p + p': { mt: 1.5 } }}
          dangerouslySetInnerHTML={{ __html: block.data.html }}
        />
      );
    case 'image':
      return (
        <Box component="figure" sx={{ m: 0 }}>
          <Box
            component="img"
            src={block.data.url}
            alt={block.data.alt}
            sx={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: 1.5 }}
          />
          {block.data.caption && (
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {block.data.caption}
            </Typography>
          )}
        </Box>
      );
    case 'video':
      return (
        <Box component="figure" sx={{ m: 0 }}>
          <Box
            component="video"
            src={block.data.url}
            controls
            sx={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: 1.5 }}
          />
          {block.data.caption && (
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {block.data.caption}
            </Typography>
          )}
        </Box>
      );
    case 'list': {
      const ordered = block.data.style === 'ordered';
      return (
        <List
          component={ordered ? 'ol' : 'ul'}
          sx={{
            listStyleType: ordered ? 'decimal' : 'disc',
            pl: 3,
            py: 0,
            '& .MuiListItem-root': { display: 'list-item', px: 0, py: 0.25 },
          }}
        >
          {block.data.items.map((item, i) => (
            <ListItem key={i} disableGutters>
              <Typography variant="body1">{item}</Typography>
            </ListItem>
          ))}
        </List>
      );
    }
    case 'callout': {
      const colors = CALLOUT_COLORS[block.data.variant];
      return (
        <Box
          component="aside"
          sx={{
            bgcolor: colors.bg,
            color: colors.fg,
            border: '1px solid',
            borderColor: colors.border,
            borderRadius: 2.5,
            p: 2,
          }}
        >
          {block.data.title && (
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{block.data.title}</Typography>
          )}
          <Typography sx={{ color: 'inherit' }}>{block.data.body}</Typography>
        </Box>
      );
    }
    case 'row': {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${block.data.columns}, 1fr)`,
            gap: 2,
          }}
        >
          {block.data.children.map((placed) => (
            <Box
              key={placed.block.id}
              sx={{ gridColumn: `${placed.colStart} / span ${placed.colSpan}` }}
            >
              {renderBlock(placed.block, answers, onAnswer, showResults)}
            </Box>
          ))}
        </Box>
      );
    }
    case 'multiple_choice': {
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
            {block.data.options.map((option, i) => (
              <FormControlLabel key={i} value={String(i)} control={<Radio size="small" />} label={option} />
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
            <FormControlLabel value="true" control={<Radio size="small" />} label="True" />
            <FormControlLabel value="false" control={<Radio size="small" />} label="False" />
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
  }
}
