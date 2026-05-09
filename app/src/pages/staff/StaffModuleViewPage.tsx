import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CardMedia, Chip,
  CircularProgress, IconButton, Paper, Typography,
} from '@mui/material';
import ArrowBackIcon        from '@mui/icons-material/ArrowBack';
import CheckCircleOutlined  from '@mui/icons-material/CheckCircleOutlined';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import ScheduleOutlined     from '@mui/icons-material/ScheduleOutlined';
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

export default function StaffModuleViewPage() {
  const { id }   = useParams<{ id: string }>();
  const moduleId = Number(id);
  const navigate = useNavigate();
  const userId   = useAuthStore((s) => s.user?.id ?? 0);

  const { data: module, isLoading, error } = usePortalModule(moduleId);
  const progress    = useModuleProgress(moduleId);
  const markComplete = useMarkComplete();

  const startTime = useRef(Date.now());
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
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

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
        </Box>

        {currentSection.heroImage && (
          <Box
            component="img"
            src={currentSection.heroImage}
            alt=""
            sx={{ width: '100%', height: 240, objectFit: 'cover', borderRadius: 3, display: 'block' }}
          />
        )}

        {(currentSection.title || currentSection.description) && (
          <Box>
            {currentSection.title && (
              <Typography variant="h2" sx={{ mb: 0.5 }}>{currentSection.title}</Typography>
            )}
            {currentSection.description && (
              <Typography color="text.secondary">{currentSection.description}</Typography>
            )}
          </Box>
        )}

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
          {sections.map((section, index) => (
            <Card
              key={section.id}
              variant="outlined"
              sx={{
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
              }}
              onClick={() => setSelectedSectionId(section.id)}
            >
              {section.heroImage && (
                <CardMedia component="img" height="160" image={section.heroImage} alt="" />
              )}
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 } }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                    {section.title || `Section ${index + 1}`}
                  </Typography>
                  {section.description && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {section.description}
                    </Typography>
                  )}
                </Box>
                <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0 }} />
              </CardContent>
            </Card>
          ))}
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
