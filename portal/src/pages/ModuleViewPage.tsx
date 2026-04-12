import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useModule, useMarkComplete }  from '../hooks/useModules';
import { useModuleProgress }           from '../hooks/useProgress';
import { upsertProgress }              from '../api/progress';
import { saveQuizAnswer, submitQuiz, fetchQuizResponses } from '../api/quiz';
import type { QuizSubmitResult }       from '../api/quiz';
import { usePortalStore }              from '../store/portalStore';
import BlockRenderer                   from '../blocks/BlockRenderer';
import type { Block }                  from '../types';

export default function ModuleViewPage() {
  const { id }     = useParams<{ id: string }>();
  const moduleId   = Number(id);
  const navigate   = useNavigate();
  const userId     = usePortalStore((s) => s.user.id);

  const { data: module, isLoading, error } = useModule(moduleId);
  const progress    = useModuleProgress(moduleId);
  const markComplete = useMarkComplete();

  const startTime   = useRef(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [answers,    setAnswers]    = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResult | null>(null);
  const [showResults, setShowResults] = useState<Record<string, boolean> | null>(null);

  // Parse blocks from module data
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

  // Mark as in_progress when the module is opened
  useEffect(() => {
    if (!moduleId || !userId) return;
    if (!progress || progress.status === 'not_started') {
      upsertProgress(userId, moduleId, 'in_progress', 0).catch(() => {});
    }
  }, [moduleId, userId, progress?.status]);

  // Load previously saved quiz answers
  useEffect(() => {
    if (!moduleId || !userId || !hasQuiz) return;
    fetchQuizResponses(userId, moduleId).then((responses) => {
      const saved: Record<string, string> = {};
      for (const r of responses) {
        saved[r.blockId] = r.answer;
      }
      if (Object.keys(saved).length > 0) {
        setAnswers(saved);
      }
    }).catch(() => {});
  }, [moduleId, userId, hasQuiz]);

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message}</p>;
  if (!module)   return null;

  const isCompleted = progress?.status === 'completed';
  const allAnswered = quizBlockIds.every((id) => answers[id] !== undefined);

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

        // Show per-question feedback
        const resultsMap: Record<string, boolean> = {};
        for (const [id, r] of Object.entries(result.results)) {
          resultsMap[id] = r.is_correct;
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

  return (
    <div>
      <p>
        <Link to="/training">← Back to training</Link>
      </p>

      <h1 dangerouslySetInnerHTML={{ __html: module.title }} />
      <p>
        {module.meta.module_estimated_minutes > 0 && `${module.meta.module_estimated_minutes} min · `}
        Status: {progress?.status ?? 'not_started'}
      </p>

      {/* Module body */}
      <article>
        {parsedBlocks.length > 0 ? (
          <BlockRenderer
            blocks={parsedBlocks}
            answers={answers}
            onAnswer={handleAnswer}
            showResults={showResults}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: module.content }} />
        )}
      </article>

      {/* Quiz result */}
      {quizResult && !quizResult.passed && (
        <div style={{ border: '1px solid red', padding: '1rem', marginBottom: '1rem' }}>
          <p><strong>Quiz not passed.</strong> Score: {quizResult.score}% (need 70% to pass)</p>
          <button onClick={() => {
            setAnswers({});
            setShowResults(null);
            setQuizResult(null);
          }}>Retry quiz</button>
        </div>
      )}
      {quizResult && quizResult.passed && (
        <div style={{ border: '1px solid green', padding: '1rem', marginBottom: '1rem' }}>
          <p><strong>Quiz passed!</strong> Score: {quizResult.score}%</p>
        </div>
      )}

      {/* Completion controls */}
      {isCompleted ? (
        <p>
          ✓ Completed
          {progress?.completedAt && ` on ${new Date(progress.completedAt).toLocaleDateString()}`}
        </p>
      ) : confirming ? (
        <div>
          <p>{hasQuiz ? 'Submit all answers and complete?' : 'Mark this module as complete?'}</p>
          <button onClick={handleMarkComplete} disabled={saving || (hasQuiz && !allAnswered)}>
            {saving ? 'Submitting…' : 'Yes, complete'}
          </button>
          <button onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
          {hasQuiz && !allAnswered && (
            <p style={{ color: '#888', marginTop: '0.25rem' }}>Answer all questions first.</p>
          )}
        </div>
      ) : (
        <button onClick={() => setConfirming(true)}>
          {hasQuiz ? 'Submit quiz & complete' : 'Mark as complete'}
        </button>
      )}

      <br />
      <button onClick={() => navigate('/training')}>Back to training</button>
    </div>
  );
}
