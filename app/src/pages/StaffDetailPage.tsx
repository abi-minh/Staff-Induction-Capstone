import { useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Link, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { useStaffMember, useStaffProgress, useStaffAssignments } from '../hooks/useStaff';
import { useModules } from '../hooks/useModules';
import { parseSections } from '../blocks/utils';
import type { ProgressRecord, ProgressStatus } from '../types';

const ROLE_LABELS: Record<string, string> = {
  staff:           'Staff',
  induction_admin: 'Induction Admin',
  administrator:   'Administrator',
};

function formatRoles(roles: string[]): string {
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(', ') || '-';
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  not_started: 'Not Started',
};

const STATUS_COLORS: Record<ProgressStatus, 'success' | 'warning' | 'default'> = {
  completed: 'success',
  in_progress: 'warning',
  not_started: 'default',
};

function quizStatus(p: ProgressRecord | undefined): { label: string; color: 'default' | 'warning' | 'success' | 'error' } {
  if (!p?.quizSubmittedAt) return { label: 'Not submitted', color: 'default' };
  if (p.passed === true)   return { label: 'Passed', color: 'success' };
  if (p.passed === false)  return { label: 'Failed', color: 'error' };
  return { label: 'Awaiting review', color: 'warning' };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StaffDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const userId   = Number(id);

  const { data: staff,    isLoading: l1 } = useStaffMember(userId);
  const { data: progress, isLoading: l2 } = useStaffProgress(userId);
  const { data: modules,  isLoading: l3 } = useModules();
  const { data: assignments = [], isLoading: l4 } = useStaffAssignments(userId);

  const moduleQuizFlags = useMemo(() => {
    const flags = new Map<number, boolean>();
    (modules ?? []).forEach((m) => {
      const sections = parseSections(m.meta.module_blocks);
      flags.set(m.id, sections.some((s) => s.isModuleQuiz && s.quizBlocks.length > 0));
    });
    return flags;
  }, [modules]);

  if (l1 || l2 || l3 || l4) return <Typography>Loading...</Typography>;
  if (!staff) return <Alert severity="warning">Staff member not found.</Alert>;

  // Most recently created progress row per module wins.
  const progressMap = new Map<number, ProgressRecord>();
  (progress ?? []).forEach((p) => {
    const existing = progressMap.get(p.moduleId);
    if (!existing || p.id > existing.id) progressMap.set(p.moduleId, p);
  });
  const assignmentMap  = new Map(assignments.map((a) => [a.moduleId, a]));
  const completedCount = Array.from(progressMap.values()).filter((p) => p.status === 'completed').length;
  const totalModules   = modules?.length ?? 0;
  const pct            = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/staff"
        variant="text"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, borderRadius: '10px' }}
      >
        Back to Staff
      </Button>

      <Typography variant="h1" sx={{ fontSize: '1.9rem', mb: 3 }}>Staff Info</Typography>

      {/* Employee Description (PB-016) */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, maxWidth: 820 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: 'primary.main' }}>
          <PersonOutlineIcon />
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Employee Description</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Name</Typography>
            <Typography sx={{ fontWeight: 600 }}>{staff.name}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Email</Typography>
            <Typography>{staff.email || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Role</Typography>
            <Typography>{formatRoles(staff.roles)}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Completion summary */}
      <Paper
        sx={{
          display: 'flex', gap: 5, p: { xs: 2.5, md: 3 }, mb: 3,
          border: '1px solid', borderColor: 'divider', borderRadius: 2, maxWidth: 820,
        }}
      >
        <Box>
          <Typography variant="h2" sx={{ fontSize: '1.75rem' }}>{completedCount}/{totalModules}</Typography>
          <Typography variant="body2" color="text.secondary">Modules completed</Typography>
        </Box>
        <Box>
          <Typography variant="h2" sx={{ fontSize: '1.75rem' }}>{pct}%</Typography>
          <Typography variant="body2" color="text.secondary">Completion rate</Typography>
        </Box>
      </Paper>

      {/* Module table: Minh's quiz-review table + PB-017 assigned/due columns */}
      <Paper
        sx={{
          overflow: 'auto',
          boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              {['Module', 'Status', 'Assigned', 'Due', 'Completed', 'Time Spent', 'Quiz Status'].map((label) => (
                <TableCell key={label} sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {(modules ?? []).map((m) => {
              const p = progressMap.get(m.id);
              const a = assignmentMap.get(m.id);
              const hasModuleQuiz = moduleQuizFlags.get(m.id) ?? false;
              const status = p?.status ?? 'not_started';
              const qs = quizStatus(p);
              return (
                <TableRow
                  key={m.id}
                  hover
                  sx={{ '& td': { py: 1.5, fontSize: '1.02rem', borderBottom: '1px solid', borderColor: 'divider' } }}
                >
                  <TableCell>
                    {hasModuleQuiz ? (
                      <Link component={RouterLink} to={`/quiz-reviews/${userId}/${m.id}`} sx={{ fontWeight: 500 }}>
                        {m.title || '(Untitled)'}
                      </Link>
                    ) : (
                      <Typography sx={{ fontWeight: 500 }}>{m.title || '(Untitled)'}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} size="small" variant="outlined" sx={{ borderRadius: 999, fontWeight: 500 }} />
                  </TableCell>
                  <TableCell>{a ? formatDate(a.assignedAt) : '—'}</TableCell>
                  <TableCell>{a?.dueDate ? formatDate(a.dueDate) : '—'}</TableCell>
                  <TableCell>{p?.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{p?.timeSpent ? `${Math.round(p.timeSpent / 60)} min` : '—'}</TableCell>
                  <TableCell>
                    {hasModuleQuiz ? (
                      <Chip label={qs.label} color={qs.color} size="small" variant="outlined" sx={{ borderRadius: 999, fontWeight: 500 }} />
                    ) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}

            {!(modules ?? []).length && (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 6 }}>
                  <Typography color="text.secondary">No modules found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
