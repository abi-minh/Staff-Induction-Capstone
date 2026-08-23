import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStaff, fetchStaffMember, fetchStaffProgress, fetchStaffAssignments, bulkAssign, unassign, fetchRoles, createStaff, removeStaff } from '../api/staff';
import type { NewStaffInput } from '../types';

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

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 1000 * 60 * 30 });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewStaffInput) => createStaff(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
    },
  });
}

export function useRemoveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) => removeStaff(userIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
    },
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
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['staffAssignments'] });
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
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['staffAssignments'] });
    },
  });
}
