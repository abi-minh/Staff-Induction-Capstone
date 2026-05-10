import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublishIcon from '@mui/icons-material/SendOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useModule, useUpdateModule } from '../hooks/useModules';
import SectionEditor from './SectionEditor';
import { parseSections } from '../blocks/utils';
import type { Section } from '../types';

const roundedButtonSx = { borderRadius: '10px' };

export default function SectionEditPage() {
  const { id, sectionId } = useParams<{ id: string; sectionId: string }>();
  const moduleId = Number(id);
  const navigate = useNavigate();

  const { data: module, isLoading, error } = useModule(moduleId);
  const updateModule = useUpdateModule(moduleId);

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

  async function handleSave(statusOverride?: 'draft' | 'publish') {
    if (!section || !module) return;
    const updated = allSections.map((s) => (s.id === sectionId ? section : s));
    await updateModule.mutateAsync({
      title: module.title,
      content: module.content,
      excerpt: module.excerpt,
      status: statusOverride ?? module.status,
      module_role_targets: module.meta.module_role_targets,
      module_estimated_minutes: module.meta.module_estimated_minutes,
      module_order: module.meta.module_order,
      module_icon: module.meta.module_icon,
      module_hero_image: module.meta.module_hero_image,
      module_blocks: JSON.stringify(updated),
    });
    navigate(`/modules/${id}`);
  }

  async function handleRemove() {
    if (!module) return;
    const updated = allSections.filter((s) => s.id !== sectionId);
    await updateModule.mutateAsync({
      title: module.title,
      content: module.content,
      excerpt: module.excerpt,
      status: module.status,
      module_role_targets: module.meta.module_role_targets,
      module_estimated_minutes: module.meta.module_estimated_minutes,
      module_order: module.meta.module_order,
      module_icon: module.meta.module_icon,
      module_hero_image: module.meta.module_hero_image,
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
            variant="outlined"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => handleSave()}
            disabled={saving || !isDirty}
            sx={roundedButtonSx}
          >
            Save
          </Button>
          <Button
            variant="contained"
            startIcon={<PublishIcon />}
            onClick={() => handleSave('publish')}
            disabled={saving}
            sx={roundedButtonSx}
          >
            Publish
          </Button>
        </Box>
      </Box>

      <SectionEditor
        section={section}
        index={sectionIndex >= 0 ? sectionIndex : 0}
        onChange={(updated) => setSection(updated)}
        onRemove={handleRemove}
      />
    </Box>
  );
}
