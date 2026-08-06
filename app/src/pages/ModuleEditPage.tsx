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
import { createSection, parseSections } from '../blocks/utils';
import { ICON_OPTIONS, getIconByKey } from '../components/iconLibrary';
import type { ModuleFormValues, Section } from '../types';

const ROLES = ['staff', 'manager', 'casual', 'all'];

const empty: ModuleFormValues = {
  title: '',
  content: '',
  excerpt: '',
  status: 'draft',
  module_role_targets: [],
  module_estimated_minutes: 0,
  module_order: 0,
  module_icon: '',
  module_hero_image: 0,
};

const roundedButtonSx = { borderRadius: '10px' };

function createEditorSnapshot(form: ModuleFormValues, sections: Section[]): string {
  return JSON.stringify({ form, sections });
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

  const [form, setForm] = useState<ModuleFormValues>(empty);
  const [sections, setSections] = useState<Section[]>([]);
  const [heroPreview, setHeroPreview] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    createEditorSnapshot(empty, [])
  );
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) {
      setInitialSnapshot(createEditorSnapshot(empty, []));
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
      module_icon: existing.meta.module_icon,
      module_hero_image: existing.meta.module_hero_image,
    };
    const nextSections = parseSections(existing.meta.module_blocks);

    setForm(nextForm);
    setSections(nextSections);
    setInitialSnapshot(createEditorSnapshot(nextForm, nextSections));
  }, [existing, isNew]);

  const saving = createModule.isLoading || updateModule.isLoading;
  const SelectedIcon = getIconByKey(form.module_icon);
  const isDirty = createEditorSnapshot(form, sections) !== initialSnapshot;

  function set<K extends keyof ModuleFormValues>(key: K, value: ModuleFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: string) {
    set(
      'module_role_targets',
      form.module_role_targets.includes(role)
        ? form.module_role_targets.filter((r) => r !== role)
        : [...form.module_role_targets, role]
    );
  }

  async function handleSave(statusOverride?: 'draft' | 'publish') {
    const values = {
      ...form,
      status: statusOverride ?? form.status,
      module_blocks: JSON.stringify(sections),
    };

    if (isNew) {
      await createModule.mutateAsync(values);
      navigate('/modules', { replace: true });
      return;
    }

    await updateModule.mutateAsync(values);
    setInitialSnapshot(createEditorSnapshot(form, sections));
  }

  async function handleAddSection() {
    const newSection = createSection();
    const newSections = [...sections, newSection];
    await updateModule.mutateAsync({
      ...form,
      module_blocks: JSON.stringify(newSections),
    });
    setSections(newSections);
    setInitialSnapshot(createEditorSnapshot(form, newSections));
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
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Role Assignment</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {ROLES.map((role) => (
                <FormControlLabel
                  key={role}
                  control={<Checkbox checked={form.module_role_targets.includes(role)} onChange={() => toggleRole(role)} />}
                  label={role}
                />
              ))}
            </Box>
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
