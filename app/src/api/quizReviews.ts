// Admin-facing APIs for grading module-level quiz submissions.

import client from './client';
import type { PendingQuizReview, QuizReviewDetail, QuizReviewQuestion } from '../types';

interface WPPendingQuizReview {
  userId: number;
  userName: string;
  moduleId: number;
  moduleTitle: string;
  quizSubmittedAt: string;
}

export async function fetchPendingQuizReviews(): Promise<PendingQuizReview[]> {
  const { data } = await client.get<WPPendingQuizReview[]>('induction/v1/quiz/pending-review');
  return data;
}

export async function fetchQuizReviewDetail(
  userId: number,
  moduleId: number
): Promise<QuizReviewDetail> {
  const { data } = await client.get<{ questions: QuizReviewQuestion[]; quizSubmittedAt: string | null }>(
    `induction/v1/quiz/review/user/${userId}/module/${moduleId}`
  );
  return data;
}

export async function gradeQuiz(
  userId: number,
  moduleId: number,
  results: Record<string, boolean>,
  passed: boolean
): Promise<{ score: number | null; passed: boolean }> {
  const { data } = await client.post<{ score: number | null; passed: boolean }>('induction/v1/quiz/grade', {
    user_id: userId,
    module_id: moduleId,
    results,
    passed,
  });
  return data;
}
