import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PublishIcon from '@mui/icons-material/SendOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useCreateModule, useModule, useUpdateModule } from '../hooks/useModules';
import { useUploadMedia } from '../hooks/useDocuments';
import { useStaff, useBulkAssign, useUnassign, useRoles, useAssignRole, useUnassignRole } from '../hooks/useStaff';
import { createSection, parseSections } from '../blocks/utils';
import { ICON_OPTIONS, getIconByKey } from '../components/iconLibrary';
import type { ModuleFormValues, Section } from '../types';

const empty: ModuleFormValues = {
  title: '',
  content: '',
  excerpt: '',
  status: 'draft',
  module_role_targets: [],
  module_estimated_minutes: 0,
  module_order: 0,
  module_duration_days: 0,
  module_icon: '',
  module_hero_image: 0,
};

const roundedButtonSx = { borderRadius: '10px' };

function createEditorSnapshot(
  form: ModuleFormValues,
  sections: Section[],
  assignedUserIds: number[],
  assignedRoles: string[]
): string {
  return JSON.stringify({
    form,
    sections,
    assignedUserIds: [...assignedUserIds].sort((a, b) => a - b),
    assignedRoles: [...assignedRoles].sort(),
  });
}

function extractAssignedUserIds(targets: string[]): number[] {
  return targets
    .filter((t) => t.startsWith('user:'))
    .map((t) => Number(t.slice('user:'.length)))
    .filter((n) => Number.isFinite(n));
}

function extractAssignedRoles(targets: string[], validRoleValues: string[]): string[] {
  return targets.filter((t) => validRoleValues.includes(t));
}

export default function ModuleEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const moduleId = isNew ? 0 : Number(id);
  const navigate = useNavigate();

  const { data: existing, isLoading, error } = useModule(moduleId);
  const createModule = useCreateModule();
  const updateModule = useUpdateModule(moduleId);
  const uploadMedia = useUploadMedia();
  const { data: staff = [] } = useStaff();
  const { data: roles = [] } = useRoles();
  const bulkAssign = useBulkAssign();
  const unassign = useUnassign();
  const assignRole = useAssignRole();
  const unassignRole = useUnassignRole();

  const [form, setForm] = useState<ModuleFormValues>(empty);
  const [sections, setSections] = useState<Section[]>([]);
  const [heroPreview, setHeroPreview] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [initialAssignedUserIds, setInitialAssignedUserIds] = useState<number[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [initialAssignedRoles, setInitialAssignedRoles] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    createEditorSnapshot(empty, [], [], [])
  );
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  // `sections` starts empty and is only filled once the module has loaded, so
  // saving before that would post an empty array over real content. This flag
  // is what makes module_blocks safe to include in the payload.
  const sectionsHydrated = useRef(false);

  useEffect(() => {
    if (isNew) {
      setInitialSnapshot(createEditorSnapshot(empty, [], [], []));
      return;
    }
    if (!existing) return;

    const nextForm: ModuleFormValues = {
      title: existing.title,
      content: existing.content,
      excerpt: existing.excerpt,
      status: existing.status,
      module_role_targets: existing.meta.module_role_targets,
      module_estimated_minutes: existing.meta.module_estimated_minutes,
      module_order: existing.meta.module_order,
      module_duration_days: existing.meta.module_duration_days,
      module_icon: existing.meta.module_icon,
      module_hero_image: existing.meta.module_hero_image,
    };
    const nextSections = parseSections(existing.meta.module_blocks);
    sectionsHydrated.current = true;
    const nextAssignedUserIds = extractAssignedUserIds(existing.meta.module_role_targets ?? []);
    const nextAssignedRoles = extractAssignedRoles(
      existing.meta.module_role_targets ?? [],
      roles.map((r) => r.value)
    );

    setForm(nextForm);
    setSections(nextSections);
    setAssignedUserIds(nextAssignedUserIds);
    setInitialAssignedUserIds(nextAssignedUserIds);
    setAssignedRoles(nextAssignedRoles);
    setInitialAssignedRoles(nextAssignedRoles);
    setInitialSnapshot(createEditorSnapshot(nextForm, nextSections, nextAssignedUserIds, nextAssignedRoles));
  }, [existing, isNew, roles]);

  const saving =
    createModule.isLoading ||
    updateModule.isLoading ||
    bulkAssign.isLoading ||
    unassign.isLoading ||
    assignRole.isLoading ||
    unassignRole.isLoading;
  const SelectedIcon = getIconByKey(form.module_icon);
  const isDirty = createEditorSnapshot(form, sections, assignedUserIds, assignedRoles) !== initialSnapshot;
  const filteredStaffForPicker = staff.filter((s) =>
    s.name.toLowerCase().includes(staffSearch.trim().toLowerCase())
  );

  function set<K extends keyof ModuleFormValues>(key: K, value: ModuleFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAssignedRole(role: string) {
    setAssignedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleAssignedUser(userId: number) {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSave(statusOverride?: 'draft' | 'publish') {
    if (isNew) {
      const values = {
        ...form,
        status: statusOverride ?? form.status,
        module_blocks: JSON.stringify(sections),
      };
      await createModule.mutateAsync(values);
      navigate('/modules', { replace: true });
      return;
    }

    // Only send section data we actually loaded. Without this, hitting Save
    // before the module finished loading — or after parseSections() failed to
    // read stored JSON — posts [] and wipes every section.
    const blocksPayload = sectionsHydrated.current
      ? { module_blocks: JSON.stringify(sections) }
      : {};

    // Staff/role assignment changes go through bulkAssign/unassign/assignRole
    // (not the plain module meta update below) so the induction_assignments
    // table — due dates, assigned-at timestamps, the Overdue report — stays
    // in sync. Each of these does a read-modify-write of the same
    // module_role_targets meta field, so they run one at a time rather than
    // in parallel — concurrent calls would each read the same starting
    // state and the last write to land would silently discard the others.
    const toAssign = assignedUserIds.filter((uid) => !initialAssignedUserIds.includes(uid));
    const toUnassign = initialAssignedUserIds.filter((uid) => !assignedUserIds.includes(uid));
    const rolesToAssign = assignedRoles.filter((r) => !initialAssignedRoles.includes(r));
    const rolesToUnassign = initialAssignedRoles.filter((r) => !assignedRoles.includes(r));

    if (toAssign.length > 0) {
      await bulkAssign.mutateAsync({ moduleId, userIds: toAssign });
    }
    if (toUnassign.length > 0) {
      await unassign.mutateAsync({ moduleId, userIds: toUnassign });
    }
    for (const role of rolesToAssign) {
      await assignRole.mutateAsync({ moduleId, role });
    }
    for (const role of rolesToUnassign) {
      await unassignRole.mutateAsync({ moduleId, role });
    }

    await updateModule.mutateAsync({
      title: form.title,
      content: form.content,
      excerpt: form.excerpt,
      status: statusOverride ?? form.status,
      module_estimated_minutes: form.module_estimated_minutes,
      module_order: form.module_order,
      module_duration_days: form.module_duration_days,
      module_icon: form.module_icon,
      module_hero_image: form.module_hero_image,
      ...blocksPayload,
    });
    setInitialSnapshot(createEditorSnapshot(form, sections, assignedUserIds, assignedRoles));
    setInitialAssignedUserIds(assignedUserIds);
    setInitialAssignedRoles(assignedRoles);
  }

  async function handleAddSection() {
    const newSection = createSection();
    const newSections = [...sections, newSection];
    await updateModule.mutateAsync({
      ...form,
      module_blocks: JSON.stringify(newSections),
    });
    setSections(newSections);
    setInitialSnapshot(createEditorSnapshot(form, newSections, assignedUserIds, assignedRoles));
    navigate(`/modules/${id}/sections/${newSection.id}`);
  }

  async function handleHeroUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    set('module_hero_image', media.id);
    setHeroPreview(media.sourceUrl);
  }

  function handleBackToModules() {
    if (isDirty) { setLeaveDialogOpen(true); return; }
    navigate('/modules');
  }

  if (!isNew && isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">Error: {(error as Error).message}</Alert>;

  return (
    <Box>
      {/* Top action bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Button variant="text" onClick={handleBackToModules} sx={roundedButtonSx}>
          ← Back to Modules
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={() => handleSave()} disabled={saving} sx={roundedButtonSx}>
            Save
          </Button>
          <Button variant="contained" startIcon={<PublishIcon />} onClick={() => handleSave('publish')} disabled={saving} sx={roundedButtonSx}>
            Publish
          </Button>
        </Box>
      </Box>

      <Dialog open={leaveDialogOpen} onClose={() => setLeaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Leave this page?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            You have unsaved changes. Do you want to discard them or save before leaving?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="text" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
          <Button variant="outlined" color="error" onClick={() => navigate('/modules')}>Discard</Button>
          <Button variant="contained" onClick={() => { setLeaveDialogOpen(false); void handleSave(); }} disabled={saving}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Module Details */}
      <Paper sx={{ p: { xs: 2.5, md: 3.5 }, mb: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)' }}>
        <Typography variant="h2" sx={{ fontSize: '1.65rem', mb: 2.5 }}>Module Details</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.3fr 0.7fr' }, gap: 2.5, mb: 2.5 }}>
          <TextField label="Module Name" value={form.title} onChange={(e) => set('title', e.target.value)} fullWidth />
          <TextField label="Module Status" select value={form.status} onChange={(e) => set('status', e.target.value as 'draft' | 'publish')} fullWidth>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="publish">Published</MenuItem>
          </TextField>
        </Box>

        <TextField label="Description" value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} multiline minRows={3} fullWidth sx={{ mb: 2.5 }} />

        <TextField label="Module Overview" helperText="Shown under the hero banner, before the section list." value={form.content} onChange={(e) => set('content', e.target.value)} multiline minRows={4} fullWidth sx={{ mb: 2.5 }} />

        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', pt: { xs: 0, sm: 1 } }}>
                <SelectedIcon style={{ fontSize: 28 }} />
              </Box>
              <TextField label="Module Icon" select value={form.module_icon} onChange={(e) => set('module_icon', e.target.value)} fullWidth sx={{ flex: 1 }}>
                <MenuItem value="">Default</MenuItem>
                {Object.entries(ICON_OPTIONS).map(([key, option]) => (
                  <MenuItem key={key} value={key}>{option.label}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField label="Estimated Minutes" type="number" value={form.module_estimated_minutes} onChange={(e) => set('module_estimated_minutes', Number(e.target.value))} />
            <TextField label="Display Order" type="number" value={form.module_order} onChange={(e) => set('module_order', Number(e.target.value))} />
            <TextField label="Duration (days to complete)" type="number" value={form.module_duration_days} onChange={(e) => set('module_duration_days', Number(e.target.value))} helperText="Sets a due date when the module is assigned. 0 = no due date." />
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Assigned Roles</Typography>
            {isNew ? (
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2.5, color: 'text.secondary' }}>
                <Typography variant="body2">Save the module first, then assign roles.</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {roles.map((r) => (
                    <FormControlLabel
                      key={r.value}
                      control={
                        <Checkbox
                          checked={assignedRoles.includes(r.value)}
                          onChange={() => toggleAssignedRole(r.value)}
                        />
                      }
                      label={r.label}
                    />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Everyone currently in a checked role is assigned this module, and anyone who joins that role later picks it up automatically. Changes are saved when you click Save or Publish.
                </Typography>
              </>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Assigned Staff</Typography>
            {isNew ? (
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2.5, color: 'text.secondary' }}>
                <Typography variant="body2">Save the module first, then assign staff.</Typography>
              </Box>
            ) : (
              <>
                <TextField
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search staff..."
                  size="small"
                  fullWidth
                  sx={{ mb: 1.5 }}
                />
                <Box sx={{ maxHeight: 280, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  {filteredStaffForPicker.length === 0 ? (
                    <Typography color="text.secondary" sx={{ p: 2 }}>No staff match your search.</Typography>
                  ) : (
                    filteredStaffForPicker.map((s) => (
                      <Box
                        key={s.id}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1, pl: 1, pr: 2,
                          borderBottom: '1px solid', borderColor: 'divider',
                          '&:last-of-type': { borderBottom: 'none' },
                        }}
                      >
                        <FormControlLabel
                          sx={{ flex: 1, minWidth: 0, mr: 0 }}
                          control={
                            <Checkbox
                              checked={assignedUserIds.includes(s.id)}
                              onChange={() => toggleAssignedUser(s.id)}
                            />
                          }
                          label={s.name}
                        />
                      </Box>
                    ))
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {assignedUserIds.length} staff member{assignedUserIds.length !== 1 ? 's' : ''} assigned. Changes are saved when you click Save or Publish.
                </Typography>
              </>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Hero Image</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <Button variant="outlined" onClick={() => heroFileRef.current?.click()} sx={roundedButtonSx}>
                {form.module_hero_image ? 'Replace Image' : 'Choose Image'}
              </Button>
              {(heroPreview || form.module_hero_image > 0) && (
                <Button color="error" onClick={() => { set('module_hero_image', 0); setHeroPreview(''); }}>Remove</Button>
              )}
            </Box>
            <input ref={heroFileRef} type="file" hidden accept="image/*" onChange={handleHeroUpload} />
            {uploadMedia.isLoading && <Typography color="text.secondary" sx={{ mb: 1.5 }}>Uploading image...</Typography>}
            <Box sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: '#f8fafc', minHeight: { xs: 180, md: 240 }, display: 'grid', placeItems: 'center' }}>
              {heroPreview ? (
                <Box component="img" src={heroPreview} alt="" sx={{ width: '100%', height: { xs: 180, md: 240 }, objectFit: 'cover' }} />
              ) : form.module_hero_image > 0 ? (
                <Typography color="text.secondary">Image #{form.module_hero_image} attached</Typography>
              ) : (
                <Typography color="text.secondary">No hero image uploaded yet</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Sections */}
      <Paper sx={{ p: { xs: 2.5, md: 3.5 }, mb: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)' }}>
        <Typography variant="h2" sx={{ fontSize: '1.65rem', mb: 2.5 }}>Sections</Typography>

        {sections.length === 0 ? (
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 3, color: 'text.secondary', mb: 2.5 }}>
            <Typography sx={{ mb: 0.5 }}>No sections yet.</Typography>
            <Typography variant="body2">
              {isNew
                ? 'Save the module first, then add sections.'
                : 'Click "Add Section" below to start building content.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, mb: 2.5 }}>
            {sections.map((section, index) => (
              <Paper
                key={section.id}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.68rem', lineHeight: 1 }}>
                      Section {index + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                        {section.title || 'Untitled section'}
                      </Typography>
                      {section.isModuleQuiz && (
                        <Chip label="Module quiz" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                      <Chip
                        label={(section.status ?? 'publish') === 'publish' ? 'Published' : 'Draft'}
                        size="small"
                        color={(section.status ?? 'publish') === 'publish' ? 'success' : 'warning'}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      {section.quizBlocks.length > 0 && (
                        <Chip
                          label={(section.quizStatus ?? 'publish') === 'publish' ? 'Quiz published' : 'Quiz draft'}
                          size="small"
                          color={(section.quizStatus ?? 'publish') === 'publish' ? 'success' : 'warning'}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {section.blocks.length} block{section.blocks.length !== 1 ? 's' : ''} · {section.quizBlocks.length} question{section.quizBlocks.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
                    onClick={() => navigate(`/modules/${id}/sections/${section.id}`)}
                    sx={{ ...roundedButtonSx, flexShrink: 0 }}
                  >
                    Edit
                  </Button>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => setSections((current) => current.filter((_, i) => i !== index))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddSection}
          disabled={isNew || saving}
          sx={roundedButtonSx}
        >
          Add Section
        </Button>
      </Paper>

      {/* Bottom action bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="text" onClick={() => navigate('/modules')} sx={roundedButtonSx}>
          ← Back to Modules
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={() => handleSave('draft')} disabled={saving} sx={roundedButtonSx}>
            Save
          </Button>
          <Button variant="contained" startIcon={<PublishIcon />} onClick={() => handleSave('publish')} disabled={saving} sx={roundedButtonSx}>
            Publish
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
