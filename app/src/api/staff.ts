import client from './client';
import type { StaffMember, ProgressRecord, AssignmentRecord, Role, NewStaffInput } from '../types';

interface InductionUser {
  id: number;
  name: string;
  slug: string;
  email: string;
  roles: string[];
  avatar_urls: Record<string, string>;
  first_name?: string;
  last_name?: string;
  dob?: string;
  suburb?: string;
  address?: string;
  profile_photo_url?: string;
  team_photo_url?: string;
  team_title?: string;
  team_region?: string;
  team_bio?: string;
  team_visible?: boolean;
  team_is_owner?: boolean;
  team_contact_email?: string;
  team_contact_phone?: string;
}

function normaliseUser(u: InductionUser): StaffMember {
  return {
    id: u.id,
    name: u.name,
    username: u.slug ?? '',
    email: u.email ?? '',
    roles: u.roles ?? [],
    avatarUrl: u.avatar_urls?.['48'] ?? u.avatar_urls?.['96'] ?? '',
    firstName: u.first_name ?? '',
    lastName: u.last_name ?? '',
    dob: u.dob ?? '',
    suburb: u.suburb ?? '',
    address: u.address ?? '',
    profilePhotoUrl: u.profile_photo_url ?? '',
    teamPhotoUrl: u.team_photo_url ?? '',
    teamTitle: u.team_title ?? '',
    teamRegion: u.team_region ?? '',
    teamBio: u.team_bio ?? '',
    teamVisible: u.team_visible ?? false,
    teamIsOwner: u.team_is_owner ?? false,
    teamContactEmail: u.team_contact_email ?? '',
    teamContactPhone: u.team_contact_phone ?? '',
  };
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data } = await client.get<InductionUser[]>('induction/v1/staff');
  return data.map(normaliseUser);
}

export async function fetchStaffMember(id: number): Promise<StaffMember> {
  const { data } = await client.get<InductionUser>(`induction/v1/staff/${id}`);
  return normaliseUser(data);
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await client.get<Role[]>('induction/v1/roles');
  return data;
}

export async function createStaffRole(name: string): Promise<Role> {
  const { data } = await client.post<Role>('induction/v1/staff-roles', { name });
  return data;
}

export async function deleteStaffRole(slug: string): Promise<{ removed: string }> {
  const { data } = await client.delete<{ removed: string }>(`induction/v1/staff-roles/${slug}`);
  return data;
}

// `notified` reports whether the account-setup email actually went out — the
// account is created either way, so this is information, not an error.
export async function createStaff(
  input: NewStaffInput,
  notify = true,
): Promise<StaffMember & { notified: boolean }> {
  const { data } = await client.post<InductionUser & { notified?: boolean }>(
    'induction/v1/staff',
    { ...input, notify },
  );
  return { ...normaliseUser(data), notified: data.notified ?? false };
}

export async function updateStaffRole(id: number, role: string): Promise<StaffMember> {
  const { data } = await client.post<InductionUser>(`induction/v1/staff/${id}/role`, { role });
  return normaliseUser(data);
}

export interface TeamProfileUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  dob?: string;
  suburb?: string;
  address?: string;
  photoMediaId?: number;
  title?: string;
  region?: string;
  bio?: string;
  visible?: boolean;
  isOwner?: boolean;
  contactEmail?: string;
  contactPhone?: string;
}

export async function updateTeamProfile(id: number, update: TeamProfileUpdate): Promise<StaffMember> {
  const { data } = await client.post<InductionUser>(`induction/v1/staff/${id}/team-profile`, {
    ...(update.firstName !== undefined && { first_name: update.firstName }),
    ...(update.lastName !== undefined && { last_name: update.lastName }),
    ...(update.email !== undefined && { email: update.email }),
    ...(update.dob !== undefined && { dob: update.dob }),
    ...(update.suburb !== undefined && { suburb: update.suburb }),
    ...(update.address !== undefined && { address: update.address }),
    ...(update.photoMediaId !== undefined && { profile_photo_media_id: update.photoMediaId }),
    ...(update.title !== undefined && { title: update.title }),
    ...(update.region !== undefined && { region: update.region }),
    ...(update.bio !== undefined && { bio: update.bio }),
    ...(update.visible !== undefined && { visible: update.visible }),
    ...(update.isOwner !== undefined && { is_owner: update.isOwner }),
    ...(update.contactEmail !== undefined && { contact_email: update.contactEmail }),
    ...(update.contactPhone !== undefined && { contact_phone: update.contactPhone }),
  });
  return normaliseUser(data);
}

export interface ReminderModule {
  moduleId: number;
  title: string;
  dueDate: string;
  dueLabel: string;
  isOverdue: boolean;
}

// The facts a reminder is drafted from. The wording itself lives in
// util/reminderEmail.ts — the server no longer composes the email.
export interface ReminderContext {
  userId: number;
  name: string;
  email: string;
  siteName: string;
  portalUrl: string;
  overdueCount: number;
  modules: ReminderModule[];
}

export async function fetchReminderContext(id: number): Promise<ReminderContext> {
  const { data } = await client.get<{
    user_id?: number;
    name?: string;
    email?: string;
    site_name?: string;
    portal_url?: string;
    overdue_count?: number;
    modules?: {
      module_id: number;
      title: string;
      due_date: string | null;
      due_label: string;
      is_overdue: boolean;
    }[];
  }>(`induction/v1/staff/${id}/reminder`);
  return {
    userId: data.user_id ?? id,
    name: data.name ?? '',
    email: data.email ?? '',
    siteName: data.site_name ?? '',
    portalUrl: data.portal_url ?? '',
    overdueCount: data.overdue_count ?? 0,
    modules: (data.modules ?? []).map((m) => ({
      moduleId: m.module_id,
      title: m.title,
      dueDate: m.due_date ?? '',
      dueLabel: m.due_label ?? '',
      isOverdue: m.is_overdue ?? false,
    })),
  };
}

// One request for a whole batch rather than one per recipient.
export async function fetchReminderContexts(ids: number[]): Promise<ReminderContext[]> {
  if (!ids.length) return [];
  const { data } = await client.get<Record<string, unknown>[]>(
    'induction/v1/staff/reminders/context',
    { params: { user_ids: ids.join(',') } },
  );
  return data.map((raw) => {
    const d = raw as {
      user_id?: number; name?: string; email?: string; site_name?: string;
      portal_url?: string; overdue_count?: number;
      modules?: { module_id: number; title: string; due_date: string | null; due_label: string; is_overdue: boolean }[];
    };
    return {
      userId: d.user_id ?? 0,
      name: d.name ?? '',
      email: d.email ?? '',
      siteName: d.site_name ?? '',
      portalUrl: d.portal_url ?? '',
      overdueCount: d.overdue_count ?? 0,
      modules: (d.modules ?? []).map((m) => ({
        moduleId: m.module_id,
        title: m.title,
        dueDate: m.due_date ?? '',
        dueLabel: m.due_label ?? '',
        isOverdue: m.is_overdue ?? false,
      })),
    };
  });
}

export interface BulkReminderMessage {
  userId: number;
  subject: string;
  body: string;
}

export interface BulkReminderResult {
  userId: number;
  name: string;
  email?: string;
  sent: boolean;
  reason: string;
}

export interface BulkReminderOutcome {
  sent: number;
  failed: number;
  results: BulkReminderResult[];
}

export async function sendBulkReminders(
  messages: BulkReminderMessage[],
): Promise<BulkReminderOutcome> {
  const { data } = await client.post<{
    sent: number;
    failed: number;
    results: { user_id: number; name: string; email?: string; sent: boolean; reason?: string }[];
  }>('induction/v1/staff/reminders', {
    messages: messages.map((m) => ({ user_id: m.userId, subject: m.subject, body: m.body })),
  });
  return {
    sent: data.sent,
    failed: data.failed,
    results: (data.results ?? []).map((r) => ({
      userId: r.user_id,
      name: r.name,
      email: r.email,
      sent: r.sent,
      reason: r.reason ?? '',
    })),
  };
}

export interface ReminderDraft {
  subject: string;
  body: string;
}

export async function sendTrainingReminder(
  id: number,
  draft: ReminderDraft,
): Promise<{ sent: boolean; email: string }> {
  const { data } = await client.post<{ sent: boolean; email?: string }>(
    `induction/v1/staff/${id}/reminder`,
    { subject: draft.subject, body: draft.body },
  );
  return { sent: data.sent, email: data.email ?? '' };
}

export async function removeStaff(userIds: number[]): Promise<{ removed: number[] }> {
  const { data } = await client.post<{ removed: number[] }>('induction/v1/staff/remove', {
    user_ids: userIds,
  });
  return data;
}

export async function bulkAssign(
  moduleId: number,
  userIds: number[],
  dueDate?: string
): Promise<{ assigned: number }> {
  const { data } = await client.post<{ assigned: number }>('induction/v1/assignments/bulk', {
    module_id: moduleId,
    user_ids: userIds,
    due_date: dueDate ?? null,
  });
  return data;
}

export async function unassign(
  moduleId: number,
  userIds: number[]
): Promise<{ removed: number }> {
  const { data } = await client.post<{ removed: number }>('induction/v1/assignments/remove', {
    module_id: moduleId,
    user_ids: userIds,
  });
  return data;
}

export async function assignRole(
  moduleId: number,
  role: string,
  dueDate?: string
): Promise<{ assigned_role: string }> {
  const { data } = await client.post<{ assigned_role: string }>('induction/v1/assignments/role', {
    module_id: moduleId,
    role,
    due_date: dueDate ?? null,
  });
  return data;
}

export async function unassignRole(
  moduleId: number,
  role: string
): Promise<{ removed_role: string }> {
  const { data } = await client.post<{ removed_role: string }>('induction/v1/assignments/role/remove', {
    module_id: moduleId,
    role,
  });
  return data;
}

interface WPProgressRecord {
  id: number;
  user_id: number;
  module_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  time_spent: number;
  score: number | null;
  passed: boolean | null;
  quiz_submitted_at: string | null;
}

function normaliseProgress(r: WPProgressRecord): ProgressRecord {
  return {
    id: r.id,
    userId: r.user_id,
    moduleId: r.module_id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    timeSpent: r.time_spent,
    score: r.score,
    passed: r.passed,
    quizSubmittedAt: r.quiz_submitted_at,
  };
}

export async function fetchStaffProgress(userId: number): Promise<ProgressRecord[]> {
  const { data } = await client.get<WPProgressRecord[]>(
    `induction/v1/progress/user/${userId}`
  );
  return data.map(normaliseProgress);
}

export async function fetchModuleProgress(moduleId: number): Promise<ProgressRecord[]> {
  const { data } = await client.get<WPProgressRecord[]>(
    `induction/v1/progress/module/${moduleId}`
  );
  return data.map(normaliseProgress);
}

export async function fetchStaffAssignments(userId: number): Promise<AssignmentRecord[]> {
  const { data } = await client.get<AssignmentRecord[]>(
    `induction/v1/assignments/records/user/${userId}`
  );
  return data;
}
