import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate }     from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Alert, CircularProgress, IconButton, Chip,
} from '@mui/material';
import ArrowBackIcon         from '@mui/icons-material/ArrowBack';
import CheckCircleOutlined   from '@mui/icons-material/CheckCircleOutlined';
import ScheduleOutlined      from '@mui/icons-material/ScheduleOutlined';
import { usePortalModule, useModuleProgress, useMarkComplete } from '../../hooks/usePortal';
import {
  upsertProgress,
  saveQuizAnswer,
  submitQuiz,
  fetchQuizResponses,
  type QuizSubmitResult,
} from '../../api/portal';
import { useAuthStore } from '../../store/authStore';
import BlockRenderer    from '../../components/BlockRenderer';
import HeroBanner       from '../../components/HeroBanner';
import type { Block }   from '../../types';

export default function StaffModuleViewPage() {
  const { id }    = useParams<{ id: string }>();
  const moduleId  = Number(id);
  const navigate  = useNavigate();
  const userId    = useAuthStore((s) => s.user?.id ?? 0);

  const { data: module, isLoading, error } = usePortalModule(moduleId);
  const progress    = useModuleProgress(moduleId);
  const markComplete = useMarkComplete();

  const startTime   = useRef(Date.now());
  const [confirming,   setConfirming]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [answers,      setAnswers]      = useState<Record<string, string>>({});
  const [quizResult,   setQuizResult]   = useState<QuizSubmitResult | null>(null);
  const [showResults,  setShowResults]  = useState<Record<string, boolean> | null>(null);

  const { parsedBlocks, hasQuiz, quizBlockIds } = useMemo(() => {
    if (!module) return { parsedBlocks: [], hasQuiz: false, quizBlockIds: [] as string[] };
    try {
      const blocks: Block[] = JSON.parse(module.meta.module_blocks);
      if (!Array.isArray(blocks)) return { parsedBlocks: [], hasQuiz: false, quizBlockIds: [] as string[] };
      const quizIds = blocks
        .filter((b) => b.type === 'multiple_choice' || b.type === 'true_false')
        .map((b) => b.id);
      return { parsedBlocks: blocks, hasQuiz: quizIds.length > 0, quizBlockIds: quizIds };
    } catch {
      return { parsedBlocks: [], hasQuiz: false, quizBlockIds: [] as string[] };
    }
  }, [module]);

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
      for (const r of responses) {
        saved[r.blockId] = r.answer;
      }
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
        if (!result.passed) {
          setSaving(false);
          setConfirming(false);
          return;
        }
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate('/portal')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Back
        </Typography>
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

      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        {parsedBlocks.length > 0 ? (
          <BlockRenderer
            blocks={parsedBlocks}
            answers={answers}
            onAnswer={handleAnswer}
            showResults={showResults}
          />
        ) : (
          <Box dangerouslySetInnerHTML={{ __html: module.content }} />
        )}
      </Paper>

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
            <Button onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
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
