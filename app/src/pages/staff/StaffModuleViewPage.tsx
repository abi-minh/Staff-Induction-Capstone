import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, IconButton, LinearProgress, MenuItem, Paper,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ArrowBackIcon        from '@mui/icons-material/ArrowBack';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import CheckCircleOutlined  from '@mui/icons-material/CheckCircleOutlined';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import ScheduleOutlined     from '@mui/icons-material/ScheduleOutlined';
import VisibilityOutlined   from '@mui/icons-material/VisibilityOutlined';
import {
  usePortalModule, useModuleProgress, useMarkComplete, useSubmitQuizForReview,
} from '../../hooks/usePortal';
import {
  upsertProgress, saveQuizAnswer, checkQuizAnswer, fetchQuizResponses,
} from '../../api/portal';
import { useAuthStore }  from '../../store/authStore';
import BlockRenderer     from '../../components/BlockRenderer';
import HeroBanner        from '../../components/HeroBanner';
import { parseSections } from '../../blocks/utils';
import type { Section }  from '../../types';

// Fallback gradients for sections without a hero image
const SECTION_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export default function StaffModuleViewPage() {
  const { id }   = useParams<{ id: string }>();
  const moduleId = Number(id);
  const navigate = useNavigate();
  const userId   = useAuthStore((s) => s.user?.id ?? 0);

  const { data: module, isLoading, error } = usePortalModule(moduleId);
  const { progress, isLoading: progressLoading } = useModuleProgress(moduleId);
  const markComplete      = useMarkComplete();
  const submitQuizReview  = useSubmitQuizForReview();

  const lsKey = `section-completions-${moduleId}`;

  const startTime = useRef(Date.now());
  const [selectedSectionId,   setSelectedSectionId]   = useState<string | null>(null);
  const [sectionView,         setSectionView]         = useState<'all' | 'completed' | 'todo'>('all');
  const [completedSectionIds, setCompletedSectionIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) ?? '[]') as string[]; }
    catch { return []; }
  });
  const [confirming,  setConfirming]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [answers,      setAnswers]      = useState<Record<string, string>>({});
  const [showResults,  setShowResults]  = useState<Record<string, boolean> | null>(null);
  const [checkingQuiz, setCheckingQuiz] = useState(false);

  const { sections, hasQuiz, moduleQuizBlockIds, hasAnyQuiz } = useMemo(() => {
    if (!module) {
      return { sections: [] as Section[], hasQuiz: false, moduleQuizBlockIds: [] as string[], hasAnyQuiz: false };
    }
    const parsed            = parseSections(module.meta.module_blocks);
    const moduleQuizSection = parsed.find((s) => s.isModuleQuiz) ?? null;
    const moduleQuizBlockIds = moduleQuizSection?.quizBlocks.map((b) => b.id) ?? [];
    const hasAnyQuiz        = parsed.some((s) => s.quizBlocks.length > 0);
    return { sections: parsed, hasQuiz: moduleQuizBlockIds.length > 0, moduleQuizBlockIds, hasAnyQuiz };
  }, [module]);

  const currentSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  useEffect(() => {
    localStorage.setItem(lsKey, JSON.stringify(completedSectionIds));
  }, [completedSectionIds, lsKey]);

  useEffect(() => {
    // Wait for the real progress record before deciding it's missing — on
    // first mount `progress` is briefly undefined purely because the fetch
    // hasn't resolved yet, which used to be mistaken for "never started"
    // and stomped an already-completed module back to in_progress.
    if (!moduleId || !userId || progressLoading) return;
    if (!progress || progress.status === 'not_started') {
      upsertProgress(userId, moduleId, 'in_progress', 0).catch(() => {});
    }
  }, [moduleId, userId, progress, progressLoading]);

  useEffect(() => {
    if (!moduleId || !userId || !hasAnyQuiz) return;
    fetchQuizResponses(userId, moduleId).then((responses) => {
      const saved: Record<string, string> = {};
      for (const r of responses) saved[r.blockId] = r.answer;
      if (Object.keys(saved).length > 0) setAnswers(saved);
    }).catch(() => {});
  }, [moduleId, userId, hasAnyQuiz]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error)   return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!module) return <Alert severity="warning">Module not found.</Alert>;

  const isCompleted   = progress?.status === 'completed';
  // The module-level quiz is graded by an admin, not self-checked — it's only
  // "done" once progress.passed comes back true. Other sections still rely on
  // the local completedSectionIds flag from the manual "Mark complete" button.
  const quizSubmittedAt = progress?.quizSubmittedAt ?? null;
  const quizPassed      = progress?.passed ?? null;
  const quizPending      = !!quizSubmittedAt && quizPassed === null;
  const quizLocked       = quizPending || quizPassed === true;

  function isSectionComplete(section: Section): boolean {
    return section.isModuleQuiz ? quizPassed === true : completedSectionIds.includes(section.id);
  }

  // Every section other than the module-level quiz section itself must be completed.
  const otherSectionsComplete = sections.filter((s) => !s.isModuleQuiz).every(isSectionComplete);
  const statusColor = isCompleted ? 'success.main' : 'warning.main';
  const StatusIcon  = isCompleted ? CheckCircleOutlined : ScheduleOutlined;
  const statusLabel = isCompleted ? 'Completed' : 'To Complete';

  function handleAnswer(blockId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
    // Changing an answer invalidates any previously checked result for it.
    setShowResults((prev) => {
      if (!prev || !(blockId in prev)) return prev;
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    saveQuizAnswer(userId, moduleId, blockId, answer).catch(() => {});
  }

  // Section-level quizzes only — the module-level quiz is graded by an admin
  // (see handleSubmitQuizForReview) and never self-checked.
  async function handleCheckQuiz(section: Section) {
    const blockIds    = section.quizBlocks.map((b) => b.id);
    const answeredIds = blockIds.filter((bid) => answers[bid] !== undefined);
    if (answeredIds.length === 0) return;
    setCheckingQuiz(true);
    try {
      const results = await Promise.all(
        answeredIds.map((bid) => checkQuizAnswer(userId, moduleId, bid, answers[bid]))
      );
      const resultMap: Record<string, boolean> = {};
      answeredIds.forEach((bid, i) => { resultMap[bid] = results[i].isCorrect; });
      setShowResults((prev) => ({ ...prev, ...resultMap }));
    } finally {
      setCheckingQuiz(false);
    }
  }

  async function handleSubmitQuizForReview() {
    await submitQuizReview.mutateAsync(moduleId);
  }

  function handleMarkSectionComplete() {
    if (!selectedSectionId) return;
    setCompletedSectionIds((prev) =>
      prev.includes(selectedSectionId) ? prev : [...prev, selectedSectionId]
    );
    setSelectedSectionId(null);
  }

  function handleUnmarkSectionComplete() {
    if (!selectedSectionId) return;
    setCompletedSectionIds((prev) => prev.filter((id) => id !== selectedSectionId));
  }

  async function handleMarkComplete() {
    setSaving(true);
    const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
    try {
      await markComplete.mutateAsync({ moduleId, timeSpent });
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Section detail view ──────────────────────────────────────────────────
  if (currentSection) {
    const sectionIndex   = sections.findIndex((s) => s.id === selectedSectionId);
    const sectionHasQuiz = currentSection.quizBlocks.length > 0;
    const isSectionDone  = isSectionComplete(currentSection);
    const prevSection    = sectionIndex > 0 ? sections[sectionIndex - 1] : null;
    const nextSection    = sectionIndex < sections.length - 1 ? sections[sectionIndex + 1] : null;
    const completedCount = sections.filter(isSectionComplete).length;
    const progressPct    = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setSelectedSectionId(null)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: 'normal' }}>Back to sections</Typography>
        </Box>

        {/* Section dropdown */}
        <TextField
          select
          size="small"
          label="Jump to section"
          value={selectedSectionId ?? ''}
          onChange={(e) => setSelectedSectionId(e.target.value)}
          fullWidth
        >
          {sections.map((s, i) => (
            <MenuItem key={s.id} value={s.id}>
              Section {i + 1}{s.title ? ` — ${s.title}` : ''}
              {isSectionComplete(s) ? '  ✓' : ''}
            </MenuItem>
          ))}
        </TextField>

        {/* Title and description */}
        {(currentSection.title || currentSection.description) && (
          <Box>
            {currentSection.title && (
              <Typography variant="h2" sx={{ mb: 0.5 }}>{currentSection.title}</Typography>
            )}
            {currentSection.description && (
              <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>{currentSection.description}</Typography>
            )}
          </Box>
        )}

        {/* Content blocks */}
        {currentSection.blocks.length > 0 && (
          <Paper sx={{ p: { xs: 3, md: 4 } }}>
            <BlockRenderer
              blocks={currentSection.blocks}
              answers={answers}
              onAnswer={handleAnswer}
              showResults={showResults}
            />
          </Paper>
        )}

        {/* Quiz */}
        {sectionHasQuiz && (
          <Paper sx={{ p: { xs: 3, md: 4 } }}>
            {currentSection.quizTitle && (
              <Typography variant="h3" sx={{ mb: 2.5 }}>{currentSection.quizTitle}</Typography>
            )}
            {currentSection.isModuleQuiz ? (
              !otherSectionsComplete ? (
                <Alert severity="warning">
                  Complete all other sections before attempting the module-level quiz.
                </Alert>
              ) : (
                <>
                  {quizPending && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Submitted — awaiting review by an admin.
                    </Alert>
                  )}
                  {quizPassed === true && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Passed — reviewed by an admin.
                    </Alert>
                  )}
                  {quizPassed === false && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Not passed. You may update your answers and resubmit.
                    </Alert>
                  )}
                  <BlockRenderer
                    blocks={currentSection.quizBlocks}
                    answers={answers}
                    onAnswer={handleAnswer}
                    showResults={null}
                    disabled={quizLocked}
                  />
                  {!quizLocked && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Use the "Submit Quiz for Review" button on the module overview page once you've answered every question.
                    </Typography>
                  )}
                </>
              )
            ) : (
              <>
                <BlockRenderer
                  blocks={currentSection.quizBlocks}
                  answers={answers}
                  onAnswer={handleAnswer}
                  showResults={showResults}
                />
                <Button
                  variant="contained"
                  onClick={() => handleCheckQuiz(currentSection)}
                  disabled={checkingQuiz || currentSection.quizBlocks.every((b) => answers[b.id] === undefined)}
                  sx={{ mt: 1 }}
                >
                  {checkingQuiz ? 'Checking…' : 'Check Answers'}
                </Button>
              </>
            )}
          </Paper>
        )}

        {/* Section complete */}
        {currentSection.isModuleQuiz ? null : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
            {isSectionDone ? (
              <Button variant="outlined" color="error" sx={{ borderRadius: '10px' }} onClick={handleUnmarkSectionComplete}>
                Unmark as complete
              </Button>
            ) : (
              <Button variant="contained" sx={{ borderRadius: '10px' }} onClick={handleMarkSectionComplete}>
                Mark section complete
              </Button>
            )}
          </Box>
        )}

        {/* Prev | Progress bar | Next */}
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => prevSection && setSelectedSectionId(prevSection.id)}
            disabled={!prevSection}
            sx={{ borderRadius: 999, flexShrink: 0 }}
          >
            ← Previous
          </Button>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Progress</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{progressPct}% complete</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{ height: 8, borderRadius: 999, bgcolor: 'divider', '& .MuiLinearProgress-bar': { borderRadius: 999 } }}
            />
          </Box>

          <Button
            variant="outlined"
            onClick={() => (nextSection ? setSelectedSectionId(nextSection.id) : setSelectedSectionId(null))}
            sx={{ borderRadius: 999, flexShrink: 0 }}
          >
            {nextSection ? 'Next →' : 'Back to Overview'}
          </Button>
        </Box>
        </Paper>
      </Box>
    );
  }

  // ── Section list view (module overview) ─────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate('/portal')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: 'normal' }}>Back to Modules</Typography>
      </Box>

      <Box sx={{ mx: { xs: -2, md: -4 } }}>
        <HeroBanner
          module={module}
          dueDate="27th June 2026"
          minutes={module.meta.module_estimated_minutes}
        />
      </Box>

      {module.content && (
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>Module Overview</Typography>
          <Box
            sx={{ color: 'text.secondary', lineHeight: 1.7, '& p': { margin: 0 }, '& p + p': { mt: 1.5 } }}
            dangerouslySetInnerHTML={{ __html: module.content }}
          />
        </Box>
      )}

      <Box>
        <Chip
          icon={<StatusIcon />}
          label={statusLabel}
          variant="outlined"
          sx={{
            borderRadius: 999,
            borderColor: statusColor,
            color: statusColor,
            fontWeight: 500,
            '& .MuiChip-icon': { color: statusColor },
          }}
        />
      </Box>

      {sections.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ToggleButtonGroup
            value={sectionView}
            exclusive
            onChange={(_, next) => next && setSectionView(next)}
            sx={{
              gap: 1,
              '&& .MuiToggleButtonGroup-grouped': {
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '999px !important',
                marginLeft: 0,
                px: 2,
                py: 0.5,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 13,
                color: 'text.secondary',
                '&:hover': { bgcolor: 'action.hover' },
              },
            }}
          >
            <ToggleButton
              value="all"
              sx={{ '&&.Mui-selected': { bgcolor: 'primary.main', color: 'white', borderColor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } } }}
            >
              All Sections
            </ToggleButton>
            <ToggleButton
              value="completed"
              sx={{
                '& .MuiSvgIcon-root': { color: 'success.main' },
                '&&.Mui-selected': { bgcolor: 'success.main', color: 'white', borderColor: 'success.main', '& .MuiSvgIcon-root': { color: 'white' }, '&:hover': { bgcolor: 'success.dark' } },
              }}
            >
              <CheckCircleOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Completed
            </ToggleButton>
            <ToggleButton
              value="todo"
              sx={{
                '& .MuiSvgIcon-root': { color: 'warning.main' },
                '&&.Mui-selected': { bgcolor: 'warning.main', color: 'white', borderColor: 'warning.main', '& .MuiSvgIcon-root': { color: 'white' }, '&:hover': { bgcolor: 'warning.dark' } },
              }}
            >
              <ScheduleOutlined fontSize="small" sx={{ mr: 0.75 }} />
              To Complete
            </ToggleButton>
          </ToggleButtonGroup>

          {sections.filter((s) => {
            const done = isSectionComplete(s);
            if (sectionView === 'completed') return done;
            if (sectionView === 'todo')      return !done;
            return true;
          }).map((section) => {
            const index = sections.indexOf(section);
            const done     = isSectionComplete(section);
            const gradient = SECTION_GRADIENTS[index % SECTION_GRADIENTS.length];
            return (
              <Card
                key={section.id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderLeftWidth: 10,
                  borderLeftColor: done ? 'grey.300' : 'primary.main',
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 } }}>
                  {/* Square hero thumbnail */}
                  <Box
                    sx={{
                      width: 88,
                      height: 88,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative',
                      background: section.heroImage ? undefined : gradient,
                    }}
                  >
                    {section.heroImage && (
                      <Box
                        component="img"
                        src={section.heroImage}
                        alt=""
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    {done && (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0,0,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 32, color: 'white' }} />
                      </Box>
                    )}
                  </Box>

                  {/* Text */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, mb: 0.5 }}
                      noWrap
                    >
                      {section.title || `Section ${index + 1}`}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                        Section {index + 1}
                      </Typography>
                      {section.isModuleQuiz && (
                        <Chip label="Module quiz" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Box>
                    {section.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {section.description}
                      </Typography>
                    )}
                  </Box>

                  {/* Action buttons */}
                  {done ? (
                    <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                      <Button
                        variant="outlined"
                        endIcon={<VisibilityOutlined />}
                        onClick={() => setSelectedSectionId(section.id)}
                        sx={{ borderRadius: 999 }}
                      >
                        Review
                      </Button>
                      <Button
                        variant="contained"
                        endIcon={<CheckCircleIcon />}
                        disabled
                        sx={{ borderRadius: 999 }}
                      >
                        Complete
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      variant="contained"
                      endIcon={<ChevronRightIcon />}
                      onClick={() => setSelectedSectionId(section.id)}
                      sx={{ flexShrink: 0, borderRadius: 999 }}
                    >
                      Attempt Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Box dangerouslySetInnerHTML={{ __html: module.content }} />
        </Paper>
      )}

      {hasQuiz && !otherSectionsComplete && !isCompleted && (
        <Alert severity="warning">
          Complete all other sections before attempting the module-level quiz.
        </Alert>
      )}
      {hasQuiz && otherSectionsComplete && quizPending && !isCompleted && (
        <Alert severity="info">
          Your module-level quiz has been submitted and is awaiting review by an admin.
        </Alert>
      )}
      {hasQuiz && quizPassed === false && !isCompleted && (
        <Alert severity="error">
          Your module-level quiz submission was not passed. Update your answers in that section, then submit again below.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
        {isCompleted ? (
          <Typography sx={{ color: 'success.main', fontWeight: 600, alignSelf: 'center' }}>
            ✓ Completed
            {progress?.completedAt && ` on ${new Date(progress.completedAt).toLocaleDateString()}`}
          </Typography>
        ) : hasQuiz ? (
          quizPending ? (
            <Typography sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Awaiting review by an admin
            </Typography>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmitQuizForReview}
              disabled={
                !otherSectionsComplete
                || submitQuizReview.isLoading
                || moduleQuizBlockIds.some((bid) => answers[bid] === undefined)
              }
            >
              {submitQuizReview.isLoading ? 'Submitting…' : 'Submit Quiz for Review'}
            </Button>
          )
        ) : confirming ? (
          <>
            <Button onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={handleMarkComplete} disabled={saving}>
              {saving ? 'Submitting…' : 'Yes, complete'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={() => setConfirming(true)}>
            Mark as complete
          </Button>
        )}
      </Box>
    </Box>
  );
}
