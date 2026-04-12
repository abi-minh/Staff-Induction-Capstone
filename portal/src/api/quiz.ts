import client from './client';
import type { QuizResponse } from '../types';

export async function saveQuizAnswer(
  userId: number, moduleId: number, blockId: string, answer: string
): Promise<void> {
  await client.post('induction/v1/quiz/save', {
    user_id: userId,
    module_id: moduleId,
    block_id: blockId,
    answer,
  });
}

export interface QuizSubmitResult {
  score: number;
  total: number;
  passed: boolean;
  results: Record<string, { is_correct: boolean; explanation: string }>;
}

export async function submitQuiz(userId: number, moduleId: number): Promise<QuizSubmitResult> {
  const { data } = await client.post('induction/v1/quiz/submit', {
    user_id: userId,
    module_id: moduleId,
  });
  return data;
}

export async function fetchQuizResponses(userId: number, moduleId: number): Promise<QuizResponse[]> {
  const { data } = await client.get(`induction/v1/quiz/responses/user/${userId}/module/${moduleId}`);
  return data;
}
