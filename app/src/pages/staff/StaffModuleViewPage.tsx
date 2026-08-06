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
import { usePortalModule, useModuleProgress, useMarkComplete } from '../../hooks/usePortal';
import {
  upsertProgress, saveQuizAnswer, checkQuizAnswer, submitQuiz, fetchQuizResponses,
  type QuizSubmitResult,
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
  const progress     = useModuleProgress(moduleId);
  const markComplete = useMarkComplete();

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
  const [answers,     setAnswers]     = useState<Record<string, string>>({});
  const [quizResult,  setQuizResult]  = useState<QuizSubmitResult | null>(null);
  const [showResults, setShowResults] = useState<Record<string, boolean> | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

  const { sections, hasQuiz, quizBlockIds, hasAnyQuiz } = useMemo(() => {
    if (!module) {
      return { sections: [] as Section[], hasQuiz: false, quizBlockIds: [] as string[], hasAnyQuiz: false };
    }
    const parsed            = parseSections(module.meta.module_blocks);
    const moduleQuizSection = parsed.find((s) => s.isModuleQuiz) ?? null;
    const quizIds           = moduleQuizSection?.quizBlocks.map((b) => b.id) ?? [];
    const hasAnyQuiz        = parsed.some((s) => s.quizBlocks.length > 0);
    return { sections: parsed, hasQuiz: quizIds.length > 0, quizBlockIds: quizIds, hasAnyQuiz };
  }, [module]);

  const currentSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  useEffect(() => {
    localStorage.setItem(lsKey, JSON.stringify(completedSectionIds));
  }, [completedSectionIds, lsKey]);

  useEffect(() => {
    if (!moduleId || !userId) return;
    if (!progress || progress.status === 'not_started') {
      upsertProgress(userId, moduleId, 'in_progress', 0).catch(() => {});
    }
  }, [moduleId, userId, progress]);

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

  const isCompleted           = progress?.status === 'completed';
  const allAnswered           = quizBlockIds.every((qid) => answers[qid] !== undefined);
  // Every section other than the module-level quiz section itself must be completed.
  const otherSectionsComplete = sections
    .filter((s) => !s.isModuleQuiz)
    .every((s) => completedSectionIds.includes(s.id));
  const statusColor = isCompleted ? 'success.main' : 'warning.main';
  const StatusIcon  = isCompleted ? CheckCircleOutlined : ScheduleOutlined;
  const statusLabel = isCompleted ? 'Completed' : 'To Complete';

  function handleAnswer(blockId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
    saveQuizAnswer(userId, moduleId, blockId, answer).catch(() => {});
  }

  async function handleCheck(blockId: string) {
    const answer = answers[blockId];
    if (answer === undefined) return;
    setCheckingIds((prev) => new Set(prev).add(blockId));
    try {
      const result = await checkQuizAnswer(userId, moduleId, blockId, answer);
      setShowResults((prev) => ({ ...prev, [blockId]: result.isCorrect }));
    } catch {
      // leave the question answerable so the user can retry
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    }
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
      if (hasQuiz) {
        const result = await submitQuiz(userId, moduleId);
        setQuizResult(result);
        const resultsMap: Record<string, boolean> = {};
        for (const [bid, r] of Object.entries(result.results)) {
          resultsMap[bid] = r.is_correct;
        }
        setShowResults(resultsMap);
        if (!result.passed) { setSaving(false); setConfirming(false); return; }
      }
      await markComplete.mutateAsync({ moduleId, timeSpent });
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  function retryQuiz() {
    setAnswers({});
    setShowResults(null);
    setQuizResult(null);
  }

  // ── Section detail view ──────────────────────────────────────────────────
  if (currentSection) {
    const sectionIndex   = sections.findIndex((s) => s.id === selectedSectionId);
    const sectionHasQuiz = currentSection.quizBlocks.length > 0;
    const isSectionDone  = completedSectionIds.includes(currentSection.id);
    const prevSection    = sectionIndex > 0 ? sections[sectionIndex - 1] : null;
    const nextSection    = sectionIndex < sections.length - 1 ? sections[sectionIndex + 1] : null;
    const completedCount = completedSectionIds.filter((id) => sections.some((s) => s.id === id)).length;
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
              {completedSectionIds.includes(s.id) ? '  ✓' : ''}
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
              onCheck={handleCheck}
              checkingBlockIds={checkingIds}
            />
          </Paper>
        )}

        {/* Quiz */}
        {sectionHasQuiz && (
          <Paper sx={{ p: { xs: 3, md: 4 } }}>
            {currentSection.quizTitle && (
              <Typography variant="h3" sx={{ mb: 2.5 }}>{currentSection.quizTitle}</Typography>
            )}
            {currentSection.isModuleQuiz && !otherSectionsComplete ? (
              <Alert severity="warning">
                Complete all other sections before attempting the module-level quiz.
              </Alert>
            ) : (
              <BlockRenderer
                blocks={currentSection.quizBlocks}
                answers={answers}
                onAnswer={handleAnswer}
                showResults={showResults}
                onCheck={handleCheck}
                checkingBlockIds={checkingIds}
              />
            )}
          </Paper>
        )}

        {/* Section complete */}
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
            onClick={() => nextSection && setSelectedSectionId(nextSection.id)}
            disabled={!nextSection}
            sx={{ borderRadius: 999, flexShrink: 0 }}
          >
            Next →
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
            const done = completedSectionIds.includes(s.id);
            if (sectionView === 'completed') return done;
            if (sectionView === 'todo')      return !done;
            return true;
          }).map((section) => {
            const index = sections.indexOf(section);
            const done     = completedSectionIds.includes(section.id);
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

      {quizResult && !quizResult.passed && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={retryQuiz}>Retry quiz</Button>}
        >
          <strong>Quiz not passed.</strong> Score: {quizResult.score}% (need 70% to pass)
        </Alert>
      )}
      {quizResult && quizResult.passed && (
        <Alert severity="success">
          <strong>Quiz passed!</strong> Score: {quizResult.score}%
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        {isCompleted ? (
          <Typography sx={{ color: 'success.main', fontWeight: 600, alignSelf: 'center' }}>
            ✓ Completed
            {progress?.completedAt && ` on ${new Date(progress.completedAt).toLocaleDateString()}`}
          </Typography>
        ) : confirming ? (
          <>
            <Button onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleMarkComplete}
              disabled={saving || (hasQuiz && (!otherSectionsComplete || !allAnswered))}
            >
              {saving ? 'Submitting…' : 'Yes, complete'}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            onClick={() => setConfirming(true)}
            disabled={hasQuiz && !otherSectionsComplete}
          >
            {hasQuiz ? 'Submit quiz & complete' : 'Mark as complete'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
