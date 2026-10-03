import { useState } from 'react';
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, MenuItem, Paper, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import type {
  Block, MultipleChoiceBlock, PostStatus, QuizBlock, Section, ShortAnswerBlock, TrueFalseBlock,
} from '../types';
import ModuleContentEditor from '../blocks/ModuleContentEditor';
import { createBlock } from '../blocks/utils';
import { useUploadMedia } from '../hooks/useDocuments';

const roundedButtonSx = { borderRadius: '10px' };

function StatusToggle({ value, onChange }: { value: PostStatus; onChange: (next: PostStatus) => void }) {
  return (
    <ToggleButtonGroup
      size="small"
      value={value}
      exclusive
      onChange={(_, next: PostStatus | null) => next && onChange(next)}
      sx={{
        '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.25, fontSize: '0.8rem' },
      }}
    >
      <ToggleButton value="draft" color="warning">Draft</ToggleButton>
      <ToggleButton value="publish" color="success">Published</ToggleButton>
    </ToggleButtonGroup>
  );
}

interface Props {
  section: Section;
  index: number;
  onChange: (section: Section) => void;
  onRemove: () => void;
}

export default function SectionEditor({ section, index, onChange, onRemove }: Props) {
  const [deleteQuestionIndex, setDeleteQuestionIndex] = useState<number | null>(null);
  const uploadMedia = useUploadMedia();
  const uploadHero = useUploadMedia();

  function set<K extends keyof Section>(key: K, value: Section[K]) {
    onChange({ ...section, [key]: value });
  }

  function handleHeroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadHero.mutate(file, {
      onSuccess: (media) => onChange({ ...section, heroImage: media.sourceUrl, heroImageMediaId: media.id }),
    });
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

  // question/explanation are shared, same-typed fields across all quiz block
  // variants — switch per-branch so TS keeps `data`'s shape tied to `type`.
  function updateSharedField(i: number, field: 'question' | 'explanation', value: string) {
    updateQuestion(i, (current) => {
      switch (current.type) {
        case 'multiple_choice': return { ...current, data: { ...current.data, [field]: value } };
        case 'true_false':      return { ...current, data: { ...current.data, [field]: value } };
        case 'short_answer':    return { ...current, data: { ...current.data, [field]: value } };
      }
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 2 }}>
        <Typography variant="h2" sx={{ fontSize: '1.65rem' }}>
          Section {index + 1}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StatusToggle value={section.status ?? 'publish'} onChange={(v) => set('status', v)} />
          <IconButton color="error" onClick={onRemove} size="small">
            <DeleteOutlineIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Hero image */}
      {section.heroImage ? (
        <Box sx={{ mb: 2.5 }}>
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
              mb: 1,
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button component="label" variant="outlined" size="small" disabled={uploadHero.isLoading} sx={roundedButtonSx}>
              {uploadHero.isLoading ? 'Uploading…' : 'Replace Image'}
              <input type="file" accept="image/*" hidden onChange={handleHeroFile} />
            </Button>
            <Button
              size="small"
              color="error"
              onClick={() => onChange({ ...section, heroImage: '', heroImageMediaId: 0 })}
              sx={roundedButtonSx}
            >
              Remove Image
            </Button>
          </Box>
        </Box>
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
          <Button component="label" variant="outlined" size="small" disabled={uploadHero.isLoading} sx={roundedButtonSx}>
            {uploadHero.isLoading ? 'Uploading…' : 'Upload Hero Image'}
            <input type="file" accept="image/*" hidden onChange={handleHeroFile} />
          </Button>
        </Box>
      )}
      {uploadHero.isError && (
        <Typography variant="body2" color="error" sx={{ mt: -1.5, mb: 2 }}>
          The image could not be uploaded. Try again, or try a different file.
        </Typography>
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
        <Typography variant="h3" sx={{ fontSize: '1.15rem', fontWeight: 700 }}>
          Quiz
        </Typography>
        <StatusToggle value={section.quizStatus ?? 'publish'} onChange={(v) => set('quizStatus', v)} />
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            checked={!!section.isModuleQuiz}
            onChange={(e) => set('isModuleQuiz', e.target.checked)}
          />
        }
        label="Use this section's quiz as the module-level quiz"
        sx={{ mb: 1.5, display: 'block' }}
      />
      {section.isModuleQuiz && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Staff must complete every other section before they can attempt this quiz.
          Marking a different section as the module-level quiz will unset this one.
        </Typography>
      )}

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
              <IconButton color="error" onClick={() => setDeleteQuestionIndex(qi)}>
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
                onChange={(e) => updateSharedField(qi, 'question', e.target.value)}
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
                    if (nextType === 'short_answer') {
                      return {
                        id: current.id,
                        type: 'short_answer',
                        data: { question: current.data.question, correctAnswer: '', explanation: '' },
                      } as ShortAnswerBlock;
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
                <MenuItem value="short_answer">Short Answer</MenuItem>
              </TextField>
            </Box>

            {block.type === 'multiple_choice' && (
              <Box sx={{ mb: 2 }}>
                {block.data.imageUrl ? (
                  <Box sx={{ position: 'relative', display: 'inline-block' }}>
                    <Box
                      component="img"
                      src={block.data.imageUrl}
                      alt=""
                      sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 1.5, display: 'block' }}
                    />
                    <Button
                      size="small"
                      color="error"
                      onClick={() =>
                        updateQuestion(qi, (current) => ({
                          ...(current as MultipleChoiceBlock),
                          data: { ...(current as MultipleChoiceBlock).data, imageMediaId: 0, imageUrl: '' },
                        }))
                      }
                      sx={{ mt: 1, ...roundedButtonSx }}
                    >
                      Remove Image
                    </Button>
                  </Box>
                ) : (
                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    startIcon={<ImageOutlinedIcon fontSize="small" />}
                    disabled={uploadMedia.isLoading}
                    sx={roundedButtonSx}
                  >
                    {uploadMedia.isLoading ? 'Uploading…' : 'Add Image (optional)'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const media = await uploadMedia.mutateAsync(file);
                        updateQuestion(qi, (current) => ({
                          ...(current as MultipleChoiceBlock),
                          data: { ...(current as MultipleChoiceBlock).data, imageMediaId: media.id, imageUrl: media.sourceUrl },
                        }));
                      }}
                    />
                  </Button>
                )}
              </Box>
            )}

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
            ) : block.type === 'true_false' ? (
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
            ) : block.type === 'short_answer' ? (
              <TextField
                label="Correct Answer"
                value={block.data.correctAnswer}
                onChange={(e) =>
                  updateQuestion(qi, (current) => ({
                    ...(current as ShortAnswerBlock),
                    data: { ...(current as ShortAnswerBlock).data, correctAnswer: e.target.value },
                  }))
                }
                helperText="Graded as a case-insensitive exact match against the student's answer."
                fullWidth
              />
            ) : null}

            <TextField
              label="Explanation (optional)"
              value={block.data.explanation}
              onChange={(e) => updateSharedField(qi, 'explanation', e.target.value)}
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

      <Dialog open={deleteQuestionIndex !== null} onClose={() => setDeleteQuestionIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this question?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {deleteQuestionIndex !== null ? `Question ${deleteQuestionIndex + 1}` : 'This question'} will be removed from the quiz. This can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="text" onClick={() => setDeleteQuestionIndex(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (deleteQuestionIndex !== null) removeQuestion(deleteQuestionIndex);
              setDeleteQuestionIndex(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
