import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Checkbox, Chip, Divider, FormControlLabel, IconButton, Link, MenuItem,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import {
  useStaffMember, useStaffProgress, useStaffAssignments, useRoles, useUpdateStaffRole,
  useUpdateTeamProfile,
} from '../hooks/useStaff';
import { useModules } from '../hooks/useModules';
import { useUploadMedia } from '../hooks/useDocuments';
import { useAuthStore } from '../store/authStore';
import { parseSections } from '../blocks/utils';
import type { ProgressRecord, ProgressStatus } from '../types';

const TEAM_TITLE_MAX_LENGTH = 60;
const TEAM_REGION_MAX_LENGTH = 60;
const TEAM_BIO_MAX_LENGTH = 280;

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
  const { data: roles = [] } = useRoles();
  const updateRole = useUpdateStaffRole();
  const uploadMedia = useUploadMedia();
  const updateTeamProfile = useUpdateTeamProfile();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [editingRole, setEditingRole] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Personal details. Saved through the same endpoint as the card fields, so
  // one Save covers the whole panel rather than two competing buttons.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [suburb, setSuburb] = useState('');
  const [address, setAddress] = useState('');

  const [teamTitle, setTeamTitle] = useState('');
  const [teamRegion, setTeamRegion] = useState('');
  const [teamBio, setTeamBio] = useState('');
  const [teamContactEmail, setTeamContactEmail] = useState('');
  const [teamContactPhone, setTeamContactPhone] = useState('');
  const [teamVisible, setTeamVisible] = useState(false);
  const [teamIsOwner, setTeamIsOwner] = useState(false);
  const [teamPhotoPreview, setTeamPhotoPreview] = useState('');
  const [teamPhotoMediaId, setTeamPhotoMediaId] = useState<number | null>(null);
  const [teamError, setTeamError] = useState('');
  const [teamSaved, setTeamSaved] = useState(false);
  const teamPhotoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!staff) return;
    setFirstName(staff.firstName);
    setLastName(staff.lastName);
    setEmail(staff.email);
    setDob(staff.dob);
    setSuburb(staff.suburb);
    setAddress(staff.address);
    setTeamTitle(staff.teamTitle);
    setTeamRegion(staff.teamRegion);
    setTeamBio(staff.teamBio);
    setTeamContactEmail(staff.teamContactEmail);
    setTeamContactPhone(staff.teamContactPhone);
    setTeamVisible(staff.teamVisible);
    setTeamIsOwner(staff.teamIsOwner);
    setTeamPhotoPreview(staff.teamPhotoUrl);
    setTeamPhotoMediaId(null);
    setTeamSaved(false);
  }, [staff]);

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

  const isAdmin = staff.roles.includes('administrator');
  const isSelf = staff.id === currentUserId;
  const canEditRole = !isAdmin && !isSelf;
  const currentRoleValue = staff.roles.find((r) => roles.some((opt) => opt.value === r)) ?? staff.roles[0] ?? '';
  const teamDirty =
    firstName !== staff.firstName ||
    lastName !== staff.lastName ||
    email !== staff.email ||
    dob !== staff.dob ||
    suburb !== staff.suburb ||
    address !== staff.address ||
    teamTitle !== staff.teamTitle ||
    teamRegion !== staff.teamRegion ||
    teamBio !== staff.teamBio ||
    teamContactEmail !== staff.teamContactEmail ||
    teamContactPhone !== staff.teamContactPhone ||
    teamVisible !== staff.teamVisible ||
    teamIsOwner !== staff.teamIsOwner ||
    teamPhotoMediaId !== null;

  async function handleRoleChange(role: string) {
    setRoleError('');
    try {
      await updateRole.mutateAsync({ id: userId, role });
      setEditingRole(false);
    } catch (err) {
      setRoleError((err as Error).message);
    }
  }

  async function handleTeamPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    setTeamPhotoMediaId(media.id);
    setTeamPhotoPreview(media.sourceUrl);
  }

  function handleRemoveTeamPhoto() {
    setTeamPhotoMediaId(0);
    setTeamPhotoPreview('');
  }

  async function handleSaveTeamProfile() {
    setTeamError('');
    setTeamSaved(false);
    try {
      await updateTeamProfile.mutateAsync({
        id: userId,
        update: {
          firstName,
          lastName,
          email,
          dob,
          suburb,
          address,
          title: teamTitle,
          region: teamRegion,
          bio: teamBio,
          contactEmail: teamContactEmail,
          contactPhone: teamContactPhone,
          visible: teamVisible,
          isOwner: teamIsOwner,
          ...(teamPhotoMediaId !== null ? { photoMediaId: teamPhotoMediaId } : {}),
        },
      });
      setTeamPhotoMediaId(null);
      setTeamSaved(true);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Could not save this staff member.');
    }
  }

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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Name</Typography>
            <Typography sx={{ fontWeight: 600 }}>{staff.name}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Username</Typography>
            <Typography>{staff.username || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Email</Typography>
            <Typography>{staff.email || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Role</Typography>
            {editingRole ? (
              <TextField
                select
                size="small"
                value={currentRoleValue}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={updateRole.isLoading}
                sx={{ mt: 0.5, minWidth: 200, display: 'block' }}
              >
                {roles.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </TextField>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography>{formatRoles(staff.roles)}</Typography>
                {canEditRole && (
                  <Tooltip title="Change role">
                    <IconButton size="small" onClick={() => setEditingRole(true)}>
                      <EditOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
            {roleError && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                {roleError}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Meet Our Team profile */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, maxWidth: 820 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: 'primary.main' }}>
          <BadgeOutlinedIcon />
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Profile &amp; Team Card</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Avatar src={teamPhotoPreview || undefined} sx={{ width: 96, height: 96, fontSize: 32, bgcolor: 'primary.main' }}>
              {staff.name.charAt(0).toUpperCase()}
            </Avatar>
            <Button
              size="small"
              variant="outlined"
              onClick={() => teamPhotoFileRef.current?.click()}
              sx={{ borderRadius: '10px' }}
            >
              {teamPhotoPreview ? 'Replace Photo' : 'Choose Photo'}
            </Button>
            {teamPhotoPreview && (
              <Button size="small" color="error" onClick={handleRemoveTeamPhoto}>Remove</Button>
            )}
            <input ref={teamPhotoFileRef} type="file" hidden accept="image/*" onChange={handleTeamPhotoUpload} />
            {uploadMedia.isLoading && (
              <Typography variant="caption" color="text.secondary">Uploading...</Typography>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <TextField
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                helperText="The displayed name follows first + last"
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Used for reminders and sign-in"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                label="Date of birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
              <TextField
                label="Suburb"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                sx={{ flex: 2, minWidth: 240 }}
              />
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <TextField
                label="Job Title"
                value={teamTitle}
                onChange={(e) => setTeamTitle(e.target.value.slice(0, TEAM_TITLE_MAX_LENGTH))}
                placeholder="Senior Instructor"
                helperText="Shown under the name — falls back to the WP role if blank"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                label="Region"
                value={teamRegion}
                onChange={(e) => setTeamRegion(e.target.value.slice(0, TEAM_REGION_MAX_LENGTH))}
                placeholder="Gold Coast"
                helperText="Location shown on the team card"
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>
            <TextField
              label="Short Bio"
              value={teamBio}
              onChange={(e) => setTeamBio(e.target.value.slice(0, TEAM_BIO_MAX_LENGTH))}
              multiline
              minRows={3}
              fullWidth
              helperText={`${teamBio.length}/${TEAM_BIO_MAX_LENGTH} — shown on the Meet Our Team page`}
              sx={{ mb: 1.5 }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={teamVisible}
                    onChange={(e) => setTeamVisible(e.target.checked)}
                  />
                }
                label="Show on the Meet Our Team page"
              />
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
                <TextField
                  label="Contact email"
                  type="email"
                  value={teamContactEmail}
                  onChange={(e) => setTeamContactEmail(e.target.value)}
                  placeholder="bookings@example.com"
                  helperText="Business address — shown on the owner's card only"
                  sx={{ flex: 1, minWidth: 220 }}
                />
                <TextField
                  label="Contact phone"
                  value={teamContactPhone}
                  onChange={(e) => setTeamContactPhone(e.target.value)}
                  helperText="Optional"
                  sx={{ flex: 1, minWidth: 180 }}
                />
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={teamIsOwner}
                    onChange={(e) => setTeamIsOwner(e.target.checked)}
                  />
                }
                label="Feature as the Owner"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -0.5 }}>
                Only one staff member can be the Owner — saving this moves the badge off whoever holds it.
              </Typography>
            </Box>
            {teamError && <Alert severity="error" sx={{ mt: 1.5 }}>{teamError}</Alert>}
            {teamSaved && !teamDirty && (
              <Alert severity="success" sx={{ mt: 1.5 }}>Team profile saved.</Alert>
            )}
            <Box sx={{ mt: 1.5 }}>
              <Button
                variant="contained"
                onClick={handleSaveTeamProfile}
                disabled={!teamDirty || updateTeamProfile.isLoading}
                sx={{ borderRadius: '10px' }}
              >
                {updateTeamProfile.isLoading ? 'Saving…' : 'Save Team Profile'}
              </Button>
            </Box>
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
          display: { xs: 'none', md: 'block' },
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

      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {(modules ?? []).map((m) => {
          const p = progressMap.get(m.id);
          const a = assignmentMap.get(m.id);
          const hasModuleQuiz = moduleQuizFlags.get(m.id) ?? false;
          const status = p?.status ?? 'not_started';
          const qs = quizStatus(p);
          return (
            <Paper key={m.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                {hasModuleQuiz ? (
                  <Link component={RouterLink} to={`/quiz-reviews/${userId}/${m.id}`} sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                    {m.title || '(Untitled)'}
                  </Link>
                ) : (
                  <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>{m.title || '(Untitled)'}</Typography>
                )}
                <Chip label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} size="small" variant="outlined" sx={{ borderRadius: 999, fontWeight: 500, flexShrink: 0 }} />
              </Box>
              <Box sx={{ mt: 1.5, display: 'grid', gap: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Assigned</Typography>
                  <Typography variant="body2">{a ? formatDate(a.assignedAt) : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Due</Typography>
                  <Typography variant="body2">{a?.dueDate ? formatDate(a.dueDate) : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Completed</Typography>
                  <Typography variant="body2">{p?.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Time spent</Typography>
                  <Typography variant="body2">{p?.timeSpent ? `${Math.round(p.timeSpent / 60)} min` : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Quiz status</Typography>
                  {hasModuleQuiz ? (
                    <Chip label={qs.label} color={qs.color} size="small" variant="outlined" sx={{ borderRadius: 999 }} />
                  ) : (
                    <Typography variant="body2">—</Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })}

        {!(modules ?? []).length && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No modules found.</Typography>
        )}
      </Box>
    </Box>
  );
}
