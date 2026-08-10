import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStaff, fetchStaffMember, fetchStaffProgress, fetchStaffAssignments, bulkAssign, unassign } from '../api/staff';

export function useStaff() {
  return useQuery({ queryKey: ['staff'], queryFn: fetchStaff, staleTime: 1000 * 60 * 5 });
}

export function useStaffMember(id: number) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => fetchStaffMember(id),
    enabled: id > 0,
  });
}

export function useStaffProgress(userId: number) {
  return useQuery({
    queryKey: ['staffProgress', userId],
    queryFn: () => fetchStaffProgress(userId),
    enabled: userId > 0,
  });
}

export function useStaffAssignments(userId: number) {
  return useQuery({
    queryKey: ['staffAssignments', userId],
    queryFn: () => fetchStaffAssignments(userId),
    enabled: userId > 0,
  });
}

export function useBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, userIds, dueDate }: { moduleId: number; userIds: number[]; dueDate?: string }) =>
      bulkAssign(moduleId, userIds, dueDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['modules'] });
    },
  });
}

export function useUnassign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, userIds }: { moduleId: number; userIds: number[] }) =>
      unassign(moduleId, userIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['modules'] });
    },
  });
}
