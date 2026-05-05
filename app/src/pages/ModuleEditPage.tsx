import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import PublishIcon from '@mui/icons-material/SendOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import TextFieldsOutlinedIcon from '@mui/icons-material/TextFieldsOutlined';
import { useCreateModule, useModule, useUpdateModule } from '../hooks/useModules';
import { useUploadMedia } from '../hooks/useDocuments';
import BlockEditor from '../blocks/BlockEditor';
import { blocksToHtml, createBlock } from '../blocks/utils';
import { ICON_OPTIONS, getIconByKey } from '../components/iconLibrary';
import type {
  Block,
  ModuleFormValues,
  MultipleChoiceBlock,
  TrueFalseBlock,
} from '../types';

const ROLES = ['staff', 'manager', 'casual', 'all'];

const empty: ModuleFormValues = {
  title: '',
  content: '',
  excerpt: '',
  status: 'draft',
  module_role_targets: [],
  module_estimated_minutes: 0,
  module_order: 0,
  module_icon: '',
  module_hero_image: 0,
};

type QuizBlock = MultipleChoiceBlock | TrueFalseBlock;
const roundedButtonSx = { borderRadius: '10px' };

function parseBlocks(raw: string | undefined): Block[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isQuizBlock(block: Block): block is QuizBlock {
  return block.type === 'multiple_choice' || block.type === 'true_false';
}

function createEditorSnapshot(
  form: ModuleFormValues,
  contentBlocks: Block[],
  quizBlocks: QuizBlock[],
  quizTitle: string,
  passingPercentage: string
): string {
  return JSON.stringify({
    form,
    contentBlocks,
    quizBlocks,
    quizTitle,
    passingPercentage,
  });
}

export default function ModuleEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const moduleId = isNew ? 0 : Number(id);
  const navigate = useNavigate();

  const { data: existing, isLoading, error } = useModule(moduleId);
  const createModule = useCreateModule();
  const updateModule = useUpdateModule(moduleId);
  const uploadMedia = useUploadMedia();

  const [form, setForm] = useState<ModuleFormValues>(empty);
  const [contentBlocks, setContentBlocks] = useState<Block[]>([]);
  const [quizBlocks, setQuizBlocks] = useState<QuizBlock[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [passingPercentage, setPassingPercentage] = useState('80');
  const [heroPreview, setHeroPreview] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    createEditorSnapshot(empty, [], [], '', '80')
  );
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const quizSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isNew) {
      setInitialSnapshot(createEditorSnapshot(empty, [], [], '', '80'));
      return;
    }

    if (!existing) return;

    const nextForm: ModuleFormValues = {
      title: existing.title,
      content: existing.content,
      excerpt: existing.excerpt,
      status: existing.status,
      module_role_targets: existing.meta.module_role_targets,
      module_estimated_minutes: existing.meta.module_estimated_minutes,
      module_order: existing.meta.module_order,
      module_icon: existing.meta.module_icon,
      module_hero_image: existing.meta.module_hero_image,
    };

    const parsed = parseBlocks(existing.meta.module_blocks);
    const nextContentBlocks = parsed.filter((block) => !isQuizBlock(block));
    const nextQuizBlocks = parsed.filter(isQuizBlock);
    const nextQuizTitle = existing.title ? `${existing.title} Quiz` : 'Module Quiz';

    setForm(nextForm);
    setContentBlocks(nextContentBlocks);
    setQuizBlocks(nextQuizBlocks);
    setQuizTitle(nextQuizTitle);
    setInitialSnapshot(
      createEditorSnapshot(nextForm, nextContentBlocks, nextQuizBlocks, nextQuizTitle, '80')
    );
  }, [existing, isNew]);

  const saving = createModule.isLoading || updateModule.isLoading;
  const SelectedIcon = getIconByKey(form.module_icon);

  const allBlocks = useMemo(
    () => [...contentBlocks, ...quizBlocks],
    [contentBlocks, quizBlocks]
  );
  const isDirty =
    createEditorSnapshot(form, contentBlocks, quizBlocks, quizTitle, passingPercentage) !==
    initialSnapshot;

  function set<K extends keyof ModuleFormValues>(key: K, value: ModuleFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: string) {
    set(
      'module_role_targets',
      form.module_role_targets.includes(role)
        ? form.module_role_targets.filter((currentRole) => currentRole !== role)
        : [...form.module_role_targets, role]
    );
  }

  function insertContentBlock(type: 'heading' | 'text' | 'image' | 'video' | 'list') {
    setContentBlocks((current) => [...current, createBlock(type)]);
  }

  function addQuizQuestion() {
    const questionBlock = createBlock('multiple_choice') as MultipleChoiceBlock;
    setQuizBlocks((current) => [...current, questionBlock]);
  }

  function updateQuizBlock(index: number, updater: (block: QuizBlock) => QuizBlock) {
    setQuizBlocks((current) =>
      current.map((block, blockIndex) => (blockIndex === index ? updater(block) : block))
    );
  }

  function removeQuizBlock(index: number) {
    setQuizBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index));
  }

  async function handleHeroUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const media = await uploadMedia.mutateAsync(file);
    set('module_hero_image', media.id);
    setHeroPreview(media.sourceUrl);
  }

  async function handleSave(statusOverride?: 'draft' | 'publish') {
    const values = {
      ...form,
      status: statusOverride ?? form.status,
      content: blocksToHtml(allBlocks),
      module_blocks: JSON.stringify(allBlocks),
    };

    if (isNew) {
      await createModule.mutateAsync(values);
      navigate('/modules', { replace: true });
      return;
    }

    await updateModule.mutateAsync(values);
    navigate('/modules');
  }

  function handleBackToModules() {
    if (isDirty) {
      setLeaveDialogOpen(true);
      return;
    }

    navigate('/modules');
  }

  if (!isNew && isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Alert severity="error">Error: {(error as Error).message}</Alert>;
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <Button variant="text" onClick={handleBackToModules}
          sx={roundedButtonSx}
          >
          ← Back to Modules
        </Button>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => handleSave()}
            disabled={saving}
            sx={roundedButtonSx}
          >
            Save
          </Button>
          <Button
            variant="contained"
            startIcon={<PublishIcon />}
            onClick={() => handleSave('publish')}
            disabled={saving}
            sx={roundedButtonSx}
          >
            Publish
          </Button>
        </Box>
      </Box>

      <Dialog
        open={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Leave this page?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            You have unsaved changes. Do you want to discard them or save before leaving?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="text" onClick={() => setLeaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => navigate('/modules')}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setLeaveDialogOpen(false);
              void handleSave();
            }}
            disabled={saving}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <Typography variant="h2" sx={{ fontSize: '1.65rem', mb: 2.5 }}>
          Module Details
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.3fr 0.7fr' },
            gap: 2.5,
            mb: 2.5,
          }}
        >
          <TextField
            label="Module Name"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            fullWidth
          />

          <TextField
            label="Module Status"
            select
            value={form.status}
            onChange={(event) => set('status', event.target.value as 'draft' | 'publish')}
            fullWidth
          >
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="publish">Published</MenuItem>
          </TextField>
        </Box>

        <TextField
          label="Description"
          value={form.excerpt}
          onChange={(event) => set('excerpt', event.target.value)}
          multiline
          minRows={3}
          fullWidth
          sx={{ mb: 2.5 }}
        />

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
          }}
        >
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  color: 'text.secondary',
                  pt: { xs: 0, sm: 1 },
                }}
              >
                <SelectedIcon style={{ fontSize: 28 }} />
              </Box>

              <TextField
                label="Module Icon"
                select
                value={form.module_icon}
                onChange={(event) => set('module_icon', event.target.value)}
                fullWidth
                sx={{ flex: 1 }}
              >
                <MenuItem value="">Default</MenuItem>
                {Object.entries(ICON_OPTIONS).map(([key, option]) => (
                  <MenuItem key={key} value={key}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <TextField
              label="Estimated Minutes"
              type="number"
              value={form.module_estimated_minutes}
              onChange={(event) =>
                set('module_estimated_minutes', Number(event.target.value))
              }
            />
            <TextField
              label="Display Order"
              type="number"
              value={form.module_order}
              onChange={(event) => set('module_order', Number(event.target.value))}
            />
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Role Assignment
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {ROLES.map((role) => (
                <FormControlLabel
                  key={role}
                  control={
                    <Checkbox
                      checked={form.module_role_targets.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                  }
                  label={role}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Hero Image
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <Button
                variant="outlined"
                onClick={() => heroFileRef.current?.click()}
                sx={roundedButtonSx}
              >
                {form.module_hero_image ? 'Replace Image' : 'Choose Image'}
              </Button>
              {(heroPreview || form.module_hero_image > 0) && (
                <Button
                  color="error"
                  onClick={() => {
                    set('module_hero_image', 0);
                    setHeroPreview('');
                  }}
                >
                  Remove
                </Button>
              )}
            </Box>

            <input
              ref={heroFileRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleHeroUpload}
            />

            {uploadMedia.isLoading && (
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                Uploading image...
              </Typography>
            )}

            <Box
              sx={{
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: '#f8fafc',
                minHeight: { xs: 180, md: 240 },
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {heroPreview ? (
                <Box
                  component="img"
                  src={heroPreview}
                  alt=""
                  sx={{ width: '100%', height: { xs: 180, md: 240 }, objectFit: 'cover' }}
                />
              ) : form.module_hero_image > 0 ? (
                <Typography color="text.secondary">
                  Image #{form.module_hero_image} attached
                </Typography>
              ) : (
                <Typography color="text.secondary">No hero image uploaded yet</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <Typography variant="h2" sx={{ fontSize: '1.65rem', mb: 1.25 }}>
          Module Content
        </Typography>

        <Box
          sx={{
            '& > div > div:last-child': {
              display: 'none',
            },
            '& strong': {
              fontSize: '1rem',
            },
            '& button': {
              fontFamily: 'inherit',
            },
          }}
        >
          <BlockEditor blocks={contentBlocks} onChange={setContentBlocks} />
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            pt: 2,
            mt: 2.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => insertContentBlock('heading')}
            sx={roundedButtonSx}
          >
            Add Heading
          </Button>
          <Button
            variant="contained"
            startIcon={<TextFieldsOutlinedIcon />}
            onClick={() => insertContentBlock('text')}
            sx={roundedButtonSx}
          >
            Add Text
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => insertContentBlock('list')}
            sx={roundedButtonSx}
          >
            Add List
          </Button>
          <Button
            variant="contained"
            startIcon={<ImageOutlinedIcon />}
            onClick={() => insertContentBlock('image')}
            sx={roundedButtonSx}
          >
            Add Image
          </Button>
          <Button
            variant="contained"
            startIcon={<OndemandVideoOutlinedIcon />}
            onClick={() => insertContentBlock('video')}
            sx={roundedButtonSx}
          >
            Add Video
          </Button>
        </Box>
      </Paper>

      <Paper
        ref={quizSectionRef}
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'center' },
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.65rem', mb: 0.75 }}>
              Module Quiz
            </Typography>
          </Box>
        </Box>

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
            value={quizTitle}
            onChange={(event) => setQuizTitle(event.target.value)}
            fullWidth
          />
          <TextField
            label="Passing Percentage"
            value={passingPercentage}
            onChange={(event) => setPassingPercentage(event.target.value)}
            fullWidth
          />
        </Box>

        {!quizBlocks.length && (
          <Box
            sx={{
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 3,
              color: 'text.secondary',
            }}
          >
            No quiz questions yet. Add a question to start building the final test.
          </Box>
        )}

        <Box sx={{ display: 'grid', gap: 2 }}>
          {quizBlocks.map((block, index) => (
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
                  Question {index + 1}
                </Typography>
                <IconButton color="error" onClick={() => removeQuizBlock(index)}>
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
                  onChange={(event) =>
                    updateQuizBlock(index, (current) =>
                      current.type === 'multiple_choice'
                        ? {
                            ...current,
                            data: {
                              ...current.data,
                              question: event.target.value,
                            },
                          }
                        : {
                            ...current,
                            data: {
                              ...current.data,
                              question: event.target.value,
                            },
                          }
                    )
                  }
                  fullWidth
                />

                <TextField
                  label="Answer Type"
                  select
                  value={block.type}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    updateQuizBlock(index, (current) => {
                      if (nextType === current.type) {
                        return current;
                      }

                      if (nextType === 'true_false') {
                        return {
                          id: current.id,
                          type: 'true_false',
                          data: {
                            question: current.data.question,
                            correctAnswer: true,
                            explanation: '',
                          },
                        };
                      }

                      return {
                        id: current.id,
                        type: 'multiple_choice',
                        data: {
                          question: current.data.question,
                          options: ['', ''],
                          correctIndex: 0,
                          explanation: '',
                        },
                      };
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
                  {block.data.options.map((option, optionIndex) => (
                    <Box
                      key={`${block.id}-option-${optionIndex}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr) 72px 40px',
                        gap: 1.25,
                        alignItems: 'center',
                      }}
                    >
                      <Checkbox
                        checked={block.data.correctIndex === optionIndex}
                        onChange={() =>
                          updateQuizBlock(index, (current) => ({
                            ...current,
                            data: {
                              ...current.data,
                              correctIndex: optionIndex,
                            },
                          }) as MultipleChoiceBlock)
                        }
                      />
                      <TextField
                        value={option}
                        onChange={(event) =>
                          updateQuizBlock(index, (current) => {
                            const next = [...(current as MultipleChoiceBlock).data.options];
                            next[optionIndex] = event.target.value;
                            return {
                              ...(current as MultipleChoiceBlock),
                              data: {
                                ...(current as MultipleChoiceBlock).data,
                                options: next,
                              },
                            };
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
                          px: block.data.correctIndex === optionIndex ? 1.25 : 0,
                          borderRadius: '8px',
                          bgcolor:
                            block.data.correctIndex === optionIndex
                              ? 'rgba(34, 197, 94, 0.12)'
                              : 'transparent',
                          color:
                            block.data.correctIndex === optionIndex
                              ? 'success.main'
                              : 'text.secondary',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          width: 72,
                          textAlign: 'center',
                        }}
                      >
                        {block.data.correctIndex === optionIndex ? 'Correct' : ''}
                      </Typography>
                      {block.data.options.length > 2 && optionIndex >= 2 ? (
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() =>
                            updateQuizBlock(index, (current) => {
                              const typedCurrent = current as MultipleChoiceBlock;
                              const nextOptions = typedCurrent.data.options.filter(
                                (_, currentOptionIndex) => currentOptionIndex !== optionIndex
                              );

                              const nextCorrectIndex =
                                typedCurrent.data.correctIndex > optionIndex
                                  ? typedCurrent.data.correctIndex - 1
                                  : typedCurrent.data.correctIndex === optionIndex
                                    ? 0
                                    : typedCurrent.data.correctIndex;

                              return {
                                ...typedCurrent,
                                data: {
                                  ...typedCurrent.data,
                                  options: nextOptions,
                                  correctIndex: nextCorrectIndex,
                                },
                              };
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
                      updateQuizBlock(index, (current) => ({
                        ...(current as MultipleChoiceBlock),
                        data: {
                          ...(current as MultipleChoiceBlock).data,
                          options: [...(current as MultipleChoiceBlock).data.options, ''],
                        },
                      }))
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
                      updateQuizBlock(index, (current) => ({
                        ...(current as TrueFalseBlock),
                        data: {
                          ...(current as TrueFalseBlock).data,
                          correctAnswer: true,
                        },
                      }))
                    }
                    sx={roundedButtonSx}
                  >
                    True
                  </Button>
                  <Button
                    variant={!block.data.correctAnswer ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateQuizBlock(index, (current) => ({
                        ...(current as TrueFalseBlock),
                        data: {
                          ...(current as TrueFalseBlock).data,
                          correctAnswer: false,
                        },
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
                onChange={(event) =>
                  updateQuizBlock(index, (current) =>
                    current.type === 'multiple_choice'
                      ? {
                          ...current,
                          data: {
                            ...current.data,
                            explanation: event.target.value,
                          },
                        }
                      : {
                          ...current,
                          data: {
                            ...current.data,
                            explanation: event.target.value,
                          },
                        }
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
          onClick={addQuizQuestion}
          sx={{ mt: 2.5, ...roundedButtonSx }}
        >
          Add Question
        </Button>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Button variant="text" onClick={() => navigate('/modules')}
          sx={roundedButtonSx}
          >
          ← Back to Modules
        </Button>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => handleSave('draft')}
            disabled={saving}
            sx={roundedButtonSx}
          >
            Save
          </Button>
          <Button
            variant="contained"
            startIcon={<PublishIcon />}
            onClick={() => handleSave('publish')}
            disabled={saving}
            sx={roundedButtonSx}
          >
            Publish
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
