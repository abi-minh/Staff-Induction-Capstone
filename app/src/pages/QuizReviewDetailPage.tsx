import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel,
  Paper, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuizReviewDetail, useGradeQuiz } from '../hooks/useQuizReviews';
import { useStaffMember } from '../hooks/useStaff';
import { useModule } from '../hooks/useModules';
import type { QuizReviewQuestion } from '../types';

function suggestedCorrect(q: QuizReviewQuestion): boolean {
  if (q.userAnswer === null) return false;
  if (q.type === 'multiple_choice') return Number(q.userAnswer) === q.correctIndex;
  if (q.type === 'true_false') return (q.userAnswer === 'true') === q.correctAnswer;
  return q.userAnswer.trim().toLowerCase() === (q.correctText ?? '').trim().toLowerCase();
}

export default function QuizReviewDetailPage() {
  const { userId: userIdParam, moduleId: moduleIdParam } = useParams<{ userId: string; moduleId: string }>();
  const userId   = Number(userIdParam);
  const moduleId = Number(moduleIdParam);
  const navigate = useNavigate();

  const { data: staff }  = useStaffMember(userId);
  const { data: module } = useModule(moduleId);
  const { data, isLoading, error } = useQuizReviewDetail(userId, moduleId);
  const gradeQuiz = useGradeQuiz();

  const [results, setResults] = useState<Record<string, boolean>>({});
  const [passed,  setPassed]  = useState<boolean | null>(null);

  useEffect(() => {
    if (!data) return;
    const seeded: Record<string, boolean> = {};
    data.questions.forEach((q) => { seeded[q.blockId] = suggestedCorrect(q); });
    setResults(seeded);
  }, [data]);

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error)      return <Alert severity="error">Error: {(error as Error).message}</Alert>;
  if (!data)      return <Alert severity="warning">Submission not found.</Alert>;

  const correctCount = Object.values(results).filter(Boolean).length;
  const total         = data.questions.length;
  const suggestedScore = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  async function handleSave() {
    if (passed === null) return;
    await gradeQuiz.mutateAsync({ userId, moduleId, results, passed });
    navigate('/quiz-reviews');
  }

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/quiz-reviews"
        variant="text"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, borderRadius: '10px' }}
      >
        Back to Quiz Reviews
      </Button>

      <Typography variant="h1" sx={{ mb: 0.5 }}>
        {module?.title || 'Module'} — {staff?.name || `User #${userId}`}
      </Typography>
      {data.quizSubmittedAt && (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Submitted {new Date(data.quizSubmittedAt).toLocaleString()}
        </Typography>
      )}

      {data.questions.map((q, qi) => (
        <Paper key={q.blockId} variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider', mb: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
            {qi + 1}. {q.question}
          </Typography>

          {q.type === 'multiple_choice' ? (
            <>
              {q.imageUrl && (
                <Box
                  component="img"
                  src={q.imageUrl}
                  alt=""
                  sx={{ display: 'block', maxWidth: '100%', maxHeight: 280, borderRadius: 1.5, mb: 1.5 }}
                />
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
                {(q.options ?? []).map((option, i) => {
                  const isCorrectOption = i === q.correctIndex;
                  const isStudentPick   = String(i) === q.userAnswer;
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: isCorrectOption ? 700 : 400, color: isCorrectOption ? 'success.main' : 'text.primary' }}
                      >
                        {option}
                      </Typography>
                      {isCorrectOption && <Chip label="Correct answer" size="small" color="success" variant="outlined" />}
                      {isStudentPick && (
                        <Chip
                          label="Student's answer"
                          size="small"
                          color={isCorrectOption ? 'success' : 'error'}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  );
                })}
                {q.userAnswer === null && (
                  <Typography variant="body2" color="text.secondary">No answer given.</Typography>
                )}
              </Box>
            </>
          ) : q.type === 'true_false' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
              <Typography variant="body2">
                Correct answer: <strong>{q.correctAnswer ? 'True' : 'False'}</strong>
              </Typography>
              <Typography variant="body2">
                Student's answer:{' '}
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 700,
                    color: q.userAnswer !== null && !suggestedCorrect(q) ? 'error.main' : 'inherit',
                  }}
                >
                  {q.userAnswer === null ? 'No answer given' : (q.userAnswer === 'true' ? 'True' : 'False')}
                </Typography>
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
              <Typography variant="body2">
                Correct answer: <strong>{q.correctText}</strong>
              </Typography>
              <Typography variant="body2">
                Student's answer:{' '}
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 700,
                    color: q.userAnswer !== null && !suggestedCorrect(q) ? 'error.main' : 'inherit',
                  }}
                >
                  {q.userAnswer === null ? 'No answer given' : q.userAnswer}
                </Typography>
              </Typography>
            </Box>
          )}

          {q.explanation && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Explanation: {q.explanation}
            </Typography>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={results[q.blockId] ?? false}
                onChange={(e) => setResults((prev) => ({ ...prev, [q.blockId]: e.target.checked }))}
              />
            }
            label="Mark this answer correct"
          />
        </Paper>
      ))}

      <Paper sx={{ p: { xs: 2.5, md: 3 }, mt: 1 }}>
        <Typography sx={{ mb: 2 }}>
          {correctCount}/{total} marked correct — suggested score {suggestedScore}%
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Button
            variant={passed === true ? 'contained' : 'outlined'}
            color="success"
            onClick={() => setPassed(true)}
            sx={{ borderRadius: '10px' }}
          >
            Pass
          </Button>
          <Button
            variant={passed === false ? 'contained' : 'outlined'}
            color="error"
            onClick={() => setPassed(false)}
            sx={{ borderRadius: '10px' }}
          >
            Fail
          </Button>
        </Box>

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={passed === null || gradeQuiz.isLoading}
          startIcon={gradeQuiz.isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {gradeQuiz.isLoading ? 'Saving…' : 'Save Grade'}
        </Button>
      </Paper>
    </Box>
  );
}
