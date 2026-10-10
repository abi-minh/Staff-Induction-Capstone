import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  fetchAssignedModules,
  fetchPortalModule,
  fetchUserProgress,
  upsertProgress,
  submitQuizForReview,
  fetchPortalDocuments,
  fetchTeam,
  setCompletedSections,
} from '../api/portal';
import { fetchStaffAssignments } from '../api/staff';
import type { ProgressRecord } from '../types';

export function useAssignedModules() {
  const userId = useAuthStore((s) => s.user?.id ?? 0);
  return useQuery({
    queryKey: ['portal', 'modules', 'assigned', userId],
    queryFn: () => fetchAssignedModules(userId),
    enabled: userId > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePortalModule(id: number) {
  return useQuery({
    queryKey: ['portal', 'module', id],
    queryFn: () => fetchPortalModule(id),
    staleTime: 1000 * 60 * 10,
  });
}

export function useUserProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? 0);
  return useQuery({
    queryKey: ['portal', 'progress', userId],
    queryFn: () => fetchUserProgress(userId),
    enabled: userId > 0,
    staleTime: 1000 * 60 * 2,
    // Progress can change externally (an admin grading a quiz) without this
    // client knowing, so always revalidate on mount rather than trusting the
    // cache — otherwise a student can be stuck looking at pre-grading state.
    refetchOnMount: 'always',
  });
}

export function useModuleProgress(moduleId: number): { progress: ProgressRecord | undefined; isLoading: boolean } {
  const { data, isLoading } = useUserProgress();
  // If the API ever returns more than one row for this module (duplicate
  // progress rows on the server), prefer the most recently created one
  // rather than whichever happens to come first.
  const progress = data
    ?.filter((p) => p.moduleId === moduleId)
    .reduce<ProgressRecord | undefined>((latest, p) => (!latest || p.id > latest.id ? p : latest), undefined);
  return { progress, isLoading };
}

export function useMarkComplete() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 0);

  return useMutation({
    mutationFn: ({ moduleId, timeSpent }: { moduleId: number; timeSpent: number }) =>
      upsertProgress(userId, moduleId, 'completed', timeSpent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'progress', userId] });
    },
  });
}

export function useSubmitQuizForReview() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 0);

  return useMutation({
    mutationFn: (moduleId: number) => submitQuizForReview(userId, moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'progress', userId] });
    },
  });
}

export function usePortalDocuments(search?: string) {
  return useQuery({
    queryKey: ['portal', 'documents', search ?? ''],
    queryFn: () => fetchPortalDocuments(search),
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true,
  });
}

export function useTeamMembers() {
  return useQuery({ queryKey: ['team'], queryFn: fetchTeam, staleTime: 1000 * 60 * 5 });
}

/**
 * The signed-in staff member's own assignment rows, which is where due dates
 * live — the module carries a duration, and the date is fixed per person when
 * they are assigned, so two people can hold the same module with different
 * deadlines. Reads through the same endpoint the admin uses; it is gated on
 * induction_can_view_own_progress, so a staff member may fetch their own.
 */
export function useMyAssignments() {
  const userId = useAuthStore((s) => s.user?.id ?? 0);
  return useQuery({
    queryKey: ['portal', 'assignments', userId],
    queryFn: () => fetchStaffAssignments(userId),
    enabled: userId > 0,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Record which sections of a module the signed-in staff member has worked
 * through. Replaces the whole set; the caller holds it.
 */
export function useSetCompletedSections(moduleId: number) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 0);

  return useMutation({
    mutationFn: (sectionIds: string[]) =>
      setCompletedSections(userId, moduleId, sectionIds),
    // The dashboard draws its progress bars from the same records.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'progress', userId] });
    },
  });
}
