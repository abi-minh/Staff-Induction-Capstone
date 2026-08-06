import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPendingQuizReviews, fetchQuizReviewDetail, gradeQuiz } from '../api/quizReviews';

export function usePendingQuizReviews() {
  return useQuery({
    queryKey: ['quizReviews', 'pending'],
    queryFn: fetchPendingQuizReviews,
    staleTime: 1000 * 30,
  });
}

export function useQuizReviewDetail(userId: number, moduleId: number) {
  return useQuery({
    queryKey: ['quizReviews', 'detail', userId, moduleId],
    queryFn: () => fetchQuizReviewDetail(userId, moduleId),
    enabled: userId > 0 && moduleId > 0,
  });
}

export function useGradeQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId, moduleId, results, passed,
    }: { userId: number; moduleId: number; results: Record<string, boolean>; passed: boolean }) =>
      gradeQuiz(userId, moduleId, results, passed),
    onSuccess: (_data, { userId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ['quizReviews', 'pending'] });
      qc.invalidateQueries({ queryKey: ['quizReviews', 'detail', userId, moduleId] });
      qc.invalidateQueries({ queryKey: ['staffProgress', userId] });
    },
  });
}
