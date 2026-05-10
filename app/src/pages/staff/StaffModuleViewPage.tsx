import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, IconButton, Paper, Typography,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ChevronRightIcon    from '@mui/icons-material/ChevronRight';
import ScheduleOutlined    from '@mui/icons-material/ScheduleOutlined';
import { usePortalModule, useModuleProgress, useMarkComplete } from '../../hooks/usePortal';
import {
  upsertProgress, saveQuizAnswer, submitQuiz, fetchQuizResponses,
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

  const startTime = useRef(Date.now());
  const [selectedSectionId,   setSelectedSectionId]   = useState<string | null>(null);
  const [completedSectionIds, setCompletedSectionIds] = useState<string[]>([]);
  const [confirming,  setConfirming]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [answers,     setAnswers]     = useState<Record<string, string>>({});
  const [quizResult,  setQuizResult]  = useState<QuizSubmitResult | null>(null);
  const [showResults, setShowResults] = useState<Record<string, boolean> | null>(null);

  const { sections, hasQuiz, quizBlockIds } = useMemo(() => {
    if (!module) return { sections: [] as Section[], hasQuiz: false, quizBlockIds: [] as string[] };
    const parsed  = parseSections(module.meta.module_blocks);
    const quizIds = parsed.flatMap((s) => s.quizBlocks.map((b) => b.id));
    return { sections: parsed, hasQuiz: quizIds.length > 0, quizBlockIds: quizIds };
  }, [module]);

  const currentSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  useEffect(() => {
    if (!moduleId || !userId) return;
    if (!progress || progress.status === 'not_started') {
      upsertProgress(userId, moduleId, 'in_progress', 0).catch(() => {});
    }
  }, [moduleId, userId, progress]);

  useEffect(() => {
    if (!moduleId || !userId || !hasQuiz) return;
    fetchQuizResponses(userId, moduleId).then((responses) => {
      const saved: Record<string, string> = {};
      for (const r of responses) saved[r.blockId] = r.answer;
      if (Object.keys(saved).length > 0) setAnswers(saved);
    }).catch(() => {});
  }, [moduleId, userId, hasQuiz]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error)   return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!module) return <Alert severity="warning">Module not found.</Alert>;

  const isCompleted = progress?.status === 'completed';
  const allAnswered = quizBlockIds.every((qid) => answers[qid] !== undefined);
  const statusColor = isCompleted ? 'success.main' : 'warning.main';
  const StatusIcon  = isCompleted ? CheckCircleOutlined : ScheduleOutlined;
  const statusLabel = isCompleted ? 'Completed' : 'To Complete';

  function handleAnswer(blockId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
    saveQuizAnswer(userId, moduleId, blockId, answer).catch(() => {});
  }

  function handleMarkSectionComplete() {
    if (!selectedSectionId) return;
    setCompletedSectionIds((prev) =>
      prev.includes(selectedSectionId) ? prev : [...prev, selectedSectionId]
    );
    setSelectedSectionId(null);
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
    const sectionIndex    = sections.findIndex((s) => s.id === selectedSectionId);
    const sectionHasQuiz  = currentSection.quizBlocks.length > 0;
    const isSectionDone   = completedSectionIds.includes(currentSection.id);
    const gradient        = SECTION_GRADIENTS[sectionIndex % SECTION_GRADIENTS.length];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setSelectedSectionId(null)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Back to sections</Typography>
          <Chip
            label={`Section ${sectionIndex + 1} of ${sections.length}`}
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
          />
          {isSectionDone && (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '16px !important' }} />}
              label="Completed"
              size="small"
              sx={{ ml: 0.5, bgcolor: 'success.light', color: 'success.dark', fontWeight: 600, border: 'none' }}
            />
          )}
        </Box>

        {/* Hero image or gradient banner */}
        <Box
          sx={{
            width: '100%',
            height: 240,
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
            background: currentSection.heroImage ? undefined : gradient,
          }}
        >
          {currentSection.heroImage && (
            <Box
              component="img"
              src={currentSection.heroImage}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          {/* Title + description overlay */}
          {(currentSection.title || currentSection.description) && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                p: { xs: 2.5, md: 3 },
              }}
            >
              {currentSection.title && (
                <Typography variant="h2" sx={{ color: 'white', mb: 0.5 }}>
                  {currentSection.title}
                </Typography>
              )}
              {currentSection.description && (
                <Typography sx={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  {currentSection.description}
                </Typography>
              )}
            </Box>
          )}
        </Box>

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
            <BlockRenderer
              blocks={currentSection.quizBlocks}
              answers={answers}
              onAnswer={handleAnswer}
              showResults={showResults}
            />
          </Paper>
        )}

        {/* Section complete button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          {isSectionDone ? (
            <Typography sx={{ color: 'success.main', fontWeight: 600, alignSelf: 'center' }}>
              ✓ Section completed
            </Typography>
          ) : (
            <Button variant="contained" onClick={handleMarkSectionComplete}>
              Mark section complete
            </Button>
          )}
        </Box>
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
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Back</Typography>
      </Box>

      <HeroBanner
        module={module}
        subtitle={module.excerpt}
        dueDate="27th June 2026"
        minutes={module.meta.module_estimated_minutes}
      />

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
          {sections.map((section, index) => {
            const done     = completedSectionIds.includes(section.id);
            const gradient = SECTION_GRADIENTS[index % SECTION_GRADIENTS.length];
            return (
              <Card
                key={section.id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  ...(done
                    ? { borderColor: 'success.main' }
                    : { '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }),
                }}
                onClick={() => setSelectedSectionId(section.id)}
              >
                {/* Hero image or gradient placeholder */}
                <Box
                  sx={{
                    height: 120,
                    position: 'relative',
                    background: section.heroImage ? undefined : gradient,
                    overflow: 'hidden',
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
                        bgcolor: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CheckCircleIcon sx={{ fontSize: 40, color: 'white' }} />
                    </Box>
                  )}
                </Box>

                <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: '0.68rem', lineHeight: 1 }}>
                        Section {index + 1}
                      </Typography>
                      {done && (
                        <Chip
                          label="Completed"
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'success.light', color: 'success.dark', fontWeight: 600, border: 'none' }}
                        />
                      )}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                      {section.title || `Section ${index + 1}`}
                    </Typography>
                    {section.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.25,
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
                  <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0, mt: 0.5 }} />
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
              disabled={saving || (hasQuiz && !allAnswered)}
            >
              {saving ? 'Submitting…' : 'Yes, complete'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={() => setConfirming(true)}>
            {hasQuiz ? 'Submit quiz & complete' : 'Mark as complete'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
