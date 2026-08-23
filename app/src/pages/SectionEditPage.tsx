import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useModule, useUpdateModule } from '../hooks/useModules';
import { fetchModule } from '../api/modules';
import SectionEditor from './SectionEditor';
import { parseSections } from '../blocks/utils';
import type { Module, Section } from '../types';

const roundedButtonSx = { borderRadius: '10px' };

export default function SectionEditPage() {
  const { id, sectionId } = useParams<{ id: string; sectionId: string }>();
  const moduleId = Number(id);
  const navigate = useNavigate();

  const { data: module, isLoading, error } = useModule(moduleId);
  const updateModule = useUpdateModule(moduleId);
  const queryClient = useQueryClient();

  const [section, setSection] = useState<Section | null>(null);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [initialJson, setInitialJson] = useState('');

  useEffect(() => {
    if (!module) return;
    const sections = parseSections(module.meta.module_blocks);
    setAllSections(sections);
    const found = sections.find((s) => s.id === sectionId) ?? null;
    setSection(found);
    setInitialJson(JSON.stringify(found));
  }, [module, sectionId]);

  const sectionIndex = allSections.findIndex((s) => s.id === sectionId);
  const isDirty = JSON.stringify(section) !== initialJson;
  const saving = updateModule.isLoading;

  function handleSectionChange(updated: Section) {
    if (updated.isModuleQuiz && !section?.isModuleQuiz) {
      // Only one section per module can be the module-level quiz.
      setAllSections((prev) => prev.map((s) => (s.id === sectionId ? s : { ...s, isModuleQuiz: false })));
    }
    setSection(updated);
  }

  // Re-fetches the module right before writing so the merge is based on the
  // latest server state, not the snapshot loaded when this page first
  // mounted — otherwise saving here can clobber sections changed elsewhere
  // (another tab, or edits made since this page was opened) with stale data.
  async function fetchLatestModule(): Promise<Module> {
    return queryClient.fetchQuery({
      queryKey: ['module', moduleId],
      queryFn: () => fetchModule(moduleId),
    });
  }

  async function handleSave() {
    if (!section || !module) return;
    const latest = await fetchLatestModule();
    const latestSections = parseSections(latest.meta.module_blocks);
    const updated = latestSections.some((s) => s.id === sectionId)
      ? latestSections.map((s) => (s.id === sectionId ? section : s))
      : [...latestSections, section];
    await updateModule.mutateAsync({
      title: latest.title,
      content: latest.content,
      excerpt: latest.excerpt,
      status: latest.status,
      module_role_targets: latest.meta.module_role_targets,
      module_estimated_minutes: latest.meta.module_estimated_minutes,
      module_order: latest.meta.module_order,
      module_icon: latest.meta.module_icon,
      module_hero_image: latest.meta.module_hero_image,
      module_blocks: JSON.stringify(updated),
    });
    navigate(`/modules/${id}`);
  }

  async function handleRemove() {
    if (!module) return;
    const latest = await fetchLatestModule();
    const updated = parseSections(latest.meta.module_blocks).filter((s) => s.id !== sectionId);
    await updateModule.mutateAsync({
      title: latest.title,
      content: latest.content,
      excerpt: latest.excerpt,
      status: latest.status,
      module_role_targets: latest.meta.module_role_targets,
      module_estimated_minutes: latest.meta.module_estimated_minutes,
      module_order: latest.meta.module_order,
      module_icon: latest.meta.module_icon,
      module_hero_image: latest.meta.module_hero_image,
      module_blocks: JSON.stringify(updated),
    });
    navigate(`/modules/${id}`);
  }

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">Error: {(error as Error).message}</Alert>;

  if (!section) {
    return (
      <Box>
        <Typography sx={{ mb: 2 }} color="text.secondary">Section not found.</Typography>
        <Button variant="outlined" onClick={() => navigate(`/modules/${id}`)} sx={roundedButtonSx}>
          Back to Module
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/modules/${id}`)}
            sx={roundedButtonSx}
          >
            Back to Module
          </Button>
          {sectionIndex >= 0 && (
            <Chip
              label={`Section ${sectionIndex + 1} of ${allSections.length}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => handleSave()}
            disabled={saving || !isDirty}
            sx={roundedButtonSx}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      <SectionEditor
        section={section}
        index={sectionIndex >= 0 ? sectionIndex : 0}
        onChange={handleSectionChange}
        onRemove={handleRemove}
      />
    </Box>
  );
}
