import {
  Box, Button, Checkbox, Divider, IconButton, MenuItem,
  Paper, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import type { Block, MultipleChoiceBlock, QuizBlock, Section, TrueFalseBlock } from '../types';
import ModuleContentEditor from '../blocks/ModuleContentEditor';
import { createBlock } from '../blocks/utils';

const roundedButtonSx = { borderRadius: '10px' };

interface Props {
  section: Section;
  index: number;
  onChange: (section: Section) => void;
  onRemove: () => void;
}

export default function SectionEditor({ section, index, onChange, onRemove }: Props) {
  function set<K extends keyof Section>(key: K, value: Section[K]) {
    onChange({ ...section, [key]: value });
  }

  function setBlocks(blocks: Block[]) {
    onChange({ ...section, blocks });
  }

  function addQuestion() {
    const q = createBlock('multiple_choice') as MultipleChoiceBlock;
    onChange({ ...section, quizBlocks: [...section.quizBlocks, q] });
  }

  function updateQuestion(i: number, updater: (b: QuizBlock) => QuizBlock) {
    onChange({
      ...section,
      quizBlocks: section.quizBlocks.map((b, bi) => (bi === i ? updater(b) : b)),
    });
  }

  function removeQuestion(i: number) {
    onChange({ ...section, quizBlocks: section.quizBlocks.filter((_, bi) => bi !== i) });
  }

  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3.5 },
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography variant="h2" sx={{ fontSize: '1.65rem' }}>
          Section {index + 1}
        </Typography>
        <IconButton color="error" onClick={onRemove} size="small">
          <DeleteOutlineIcon />
        </IconButton>
      </Box>

      {/* Hero image */}
      <TextField
        label="Hero Image URL"
        value={section.heroImage}
        onChange={(e) => set('heroImage', e.target.value)}
        fullWidth
        placeholder="https://…"
        sx={{ mb: 2 }}
      />

      {section.heroImage ? (
        <Box
          component="img"
          src={section.heroImage}
          alt=""
          sx={{
            width: '100%',
            height: { xs: 160, md: 220 },
            objectFit: 'cover',
            borderRadius: 1,
            display: 'block',
            mb: 2.5,
          }}
        />
      ) : (
        <Box
          sx={{
            height: { xs: 120, md: 160 },
            bgcolor: 'grey.50',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            color: 'text.disabled',
            mb: 2.5,
          }}
        >
          <ImageOutlinedIcon sx={{ fontSize: 36 }} />
          <Typography variant="body2">No hero image set</Typography>
        </Box>
      )}

      {/* Title + Description */}
      <TextField
        label="Section Title"
        value={section.title}
        onChange={(e) => set('title', e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />
      <TextField
        label="Description"
        value={section.description}
        onChange={(e) => set('description', e.target.value)}
        fullWidth
        multiline
        minRows={2}
      />

      <Divider sx={{ my: 3 }} />

      {/* Content blocks */}
      <Typography variant="h3" sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 2 }}>
        Content
      </Typography>
      <ModuleContentEditor blocks={section.blocks} onChange={setBlocks} />

      <Divider sx={{ my: 3 }} />

      {/* Quiz */}
      <Typography variant="h3" sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 2.5 }}>
        Quiz
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.4fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <TextField
          label="Quiz Title"
          value={section.quizTitle}
          onChange={(e) => set('quizTitle', e.target.value)}
          fullWidth
        />
        <TextField
          label="Passing Percentage"
          type="number"
          value={section.passingPercentage}
          onChange={(e) => set('passingPercentage', Number(e.target.value))}
          fullWidth
        />
      </Box>

      {section.quizBlocks.length === 0 && (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 3,
            color: 'text.secondary',
            mb: 2,
          }}
        >
          No questions yet. Add a question to build this section's quiz.
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2 }}>
        {section.quizBlocks.map((block, qi) => (
          <Paper
            key={block.id}
            variant="outlined"
            sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                mb: 2,
              }}
            >
              <Typography variant="h3" sx={{ fontSize: '1.15rem' }}>
                Question {qi + 1}
              </Typography>
              <IconButton color="error" onClick={() => removeQuestion(qi)}>
                <DeleteOutlineIcon />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.5fr' },
                gap: 2,
                mb: 2,
              }}
            >
              <TextField
                label="Question"
                value={block.data.question}
                onChange={(e) =>
                  updateQuestion(qi, (current) =>
                    current.type === 'multiple_choice'
                      ? { ...current, data: { ...current.data, question: e.target.value } }
                      : { ...current, data: { ...current.data, question: e.target.value } }
                  )
                }
                fullWidth
              />
              <TextField
                label="Answer Type"
                select
                value={block.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  updateQuestion(qi, (current) => {
                    if (nextType === current.type) return current;
                    if (nextType === 'true_false') {
                      return {
                        id: current.id,
                        type: 'true_false',
                        data: { question: current.data.question, correctAnswer: true, explanation: '' },
                      } as TrueFalseBlock;
                    }
                    return {
                      id: current.id,
                      type: 'multiple_choice',
                      data: { question: current.data.question, options: ['', ''], correctIndex: 0, explanation: '' },
                    } as MultipleChoiceBlock;
                  });
                }}
                fullWidth
              >
                <MenuItem value="multiple_choice">Multiple Choice</MenuItem>
                <MenuItem value="true_false">True / False</MenuItem>
              </TextField>
            </Box>

            {block.type === 'multiple_choice' ? (
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {block.data.options.map((option, oi) => (
                  <Box
                    key={`${block.id}-option-${oi}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'auto minmax(0, 1fr) 72px 40px',
                      gap: 1.25,
                      alignItems: 'center',
                    }}
                  >
                    <Checkbox
                      checked={block.data.correctIndex === oi}
                      onChange={() =>
                        updateQuestion(qi, (current) => ({
                          ...current,
                          data: { ...current.data, correctIndex: oi },
                        }) as MultipleChoiceBlock)
                      }
                    />
                    <TextField
                      value={option}
                      onChange={(e) =>
                        updateQuestion(qi, (current) => {
                          const mc = current as MultipleChoiceBlock;
                          const next = [...mc.data.options];
                          next[oi] = e.target.value;
                          return { ...mc, data: { ...mc.data, options: next } };
                        })
                      }
                      fullWidth
                      size="small"
                    />
                    <Typography
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 28,
                        px: block.data.correctIndex === oi ? 1.25 : 0,
                        borderRadius: '8px',
                        bgcolor:
                          block.data.correctIndex === oi ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                        color: block.data.correctIndex === oi ? 'success.main' : 'text.secondary',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        width: 72,
                        textAlign: 'center',
                      }}
                    >
                      {block.data.correctIndex === oi ? 'Correct' : ''}
                    </Typography>
                    {block.data.options.length > 2 && oi >= 2 ? (
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() =>
                          updateQuestion(qi, (current) => {
                            const mc = current as MultipleChoiceBlock;
                            const nextOptions = mc.data.options.filter((_, idx) => idx !== oi);
                            const nextCorrect =
                              mc.data.correctIndex > oi
                                ? mc.data.correctIndex - 1
                                : mc.data.correctIndex === oi
                                  ? 0
                                  : mc.data.correctIndex;
                            return { ...mc, data: { ...mc.data, options: nextOptions, correctIndex: nextCorrect } };
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <Box />
                    )}
                  </Box>
                ))}

                <Button
                  variant="text"
                  startIcon={<AddIcon />}
                  sx={{ justifyContent: 'flex-start', width: 'fit-content', ...roundedButtonSx }}
                  onClick={() =>
                    updateQuestion(qi, (current) => {
                      const mc = current as MultipleChoiceBlock;
                      return { ...mc, data: { ...mc.data, options: [...mc.data.options, ''] } };
                    })
                  }
                >
                  Add Option
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                <Button
                  variant={block.data.correctAnswer ? 'contained' : 'outlined'}
                  onClick={() =>
                    updateQuestion(qi, (current) => ({
                      ...(current as TrueFalseBlock),
                      data: { ...(current as TrueFalseBlock).data, correctAnswer: true },
                    }))
                  }
                  sx={roundedButtonSx}
                >
                  True
                </Button>
                <Button
                  variant={!block.data.correctAnswer ? 'contained' : 'outlined'}
                  onClick={() =>
                    updateQuestion(qi, (current) => ({
                      ...(current as TrueFalseBlock),
                      data: { ...(current as TrueFalseBlock).data, correctAnswer: false },
                    }))
                  }
                  sx={roundedButtonSx}
                >
                  False
                </Button>
              </Box>
            )}

            <TextField
              label="Explanation (optional)"
              value={block.data.explanation}
              onChange={(e) =>
                updateQuestion(qi, (current) =>
                  current.type === 'multiple_choice'
                    ? { ...current, data: { ...current.data, explanation: e.target.value } }
                    : { ...current, data: { ...current.data, explanation: e.target.value } }
                )
              }
              multiline
              minRows={2}
              fullWidth
              sx={{ mt: 2 }}
            />
          </Paper>
        ))}
      </Box>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={addQuestion}
        sx={{ mt: 2.5, ...roundedButtonSx }}
      >
        Add Question
      </Button>
    </Paper>
  );
}
