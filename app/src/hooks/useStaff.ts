import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStaff, fetchStaffMember, fetchStaffProgress, fetchStaffAssignments, bulkAssign, unassign, assignRole, unassignRole, fetchRoles, createStaffRole, deleteStaffRole, createStaff, removeStaff, updateStaffRole, updateTeamProfile, fetchReminderContext, fetchReminderContexts, sendTrainingReminder, sendBulkReminders, setAssignmentDueDate } from '../api/staff';
import type { TeamProfileUpdate, ReminderDraft, BulkReminderMessage } from '../api/staff';
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

export function useCreateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createStaffRole(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useDeleteStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => deleteStaffRole(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, notify = true }: { input: NewStaffInput; notify?: boolean }) =>
      createStaff(input, notify),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
    },
  });
}

export function useUpdateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => updateStaffRole(id, role),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff', variables.id] });
    },
  });
}

export function useUpdateTeamProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: number; update: TeamProfileUpdate }) => updateTeamProfile(id, update),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff', variables.id] });
      qc.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

// Facts the compose dialog drafts from. Not cached for long: a reminder should
// reflect what the member owes right now, not what they owed five minutes ago.
export function useReminderContext(userId: number) {
  return useQuery({
    queryKey: ['reminderContext', userId],
    queryFn: () => fetchReminderContext(userId),
    enabled: userId > 0,
    staleTime: 0,
  });
}

// Facts for a whole batch, fetched once when the bulk dialog opens.
export function useReminderContexts(userIds: number[]) {
  return useQuery({
    queryKey: ['reminderContexts', [...userIds].sort((a, b) => a - b)],
    queryFn: () => fetchReminderContexts(userIds),
    enabled: userIds.length > 0,
    staleTime: 0,
  });
}

export function useSendBulkReminders() {
  return useMutation({
    mutationFn: (messages: BulkReminderMessage[]) => sendBulkReminders(messages),
  });
}

// Sending a reminder changes nothing the app caches, so there's no
// invalidation here — the caller reports the outcome and moves on.
export function useSendTrainingReminder() {
  return useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: ReminderDraft }) =>
      sendTrainingReminder(id, draft),
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
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['staffAssignments'] });
      qc.invalidateQueries({ queryKey: ['portal', 'module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['portal', 'modules', 'assigned'] });
    },
  });
}

export function useUnassign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, userIds }: { moduleId: number; userIds: number[] }) =>
      unassign(moduleId, userIds),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['staffAssignments'] });
      qc.invalidateQueries({ queryKey: ['portal', 'module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['portal', 'modules', 'assigned'] });
    },
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, role, dueDate }: { moduleId: number; role: string; dueDate?: string }) =>
      assignRole(moduleId, role, dueDate),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['staffAssignments'] });
      qc.invalidateQueries({ queryKey: ['portal', 'module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['portal', 'modules', 'assigned'] });
    },
  });
}

export function useUnassignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, role }: { moduleId: number; role: string }) => unassignRole(moduleId, role),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['staffAssignments'] });
      qc.invalidateQueries({ queryKey: ['portal', 'module', variables.moduleId] });
      qc.invalidateQueries({ queryKey: ['portal', 'modules', 'assigned'] });
    },
  });
}

export function useSetAssignmentDueDate(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, dueDate }: { moduleId: number; dueDate: string }) =>
      setAssignmentDueDate(userId, moduleId, dueDate),
    // The staff detail page reads due dates from the assignment rows, and the
    // portal card reads the same endpoint, so both have to be refetched.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffAssignments', userId] });
      queryClient.invalidateQueries({ queryKey: ['portal', 'assignments'] });
    },
  });
}
