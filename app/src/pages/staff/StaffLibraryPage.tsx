import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { usePortalDocuments, useAssignedModules } from '../../hooks/usePortal';
import { useResourceCategories } from '../../hooks/useResourceCategories';
import { materialsFromModules } from '../../util/moduleMaterials';
import type { MediaType } from '../../types';

function TypeIcon({ type }: { type: MediaType }) {
  const Icon =
    type === 'image' ? ImageOutlinedIcon
      : type === 'video' ? MovieOutlinedIcon
        : type === 'pdf' ? PictureAsPdfOutlinedIcon
          : InsertDriveFileOutlinedIcon;
  const color =
    type === 'pdf' ? 'error.main'
      : type === 'video' ? 'success.main'
        : type === 'image' ? 'info.main'
          : 'text.secondary';
  return <Icon sx={{ color, flexShrink: 0 }} />;
}

function ResourceCard({ icon, title, subtitle, url }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  url?: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {icon}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 500, wordBreak: 'break-word' }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        {url && (
          <Button
            href={url}
            target="_blank"
            rel="noreferrer"
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon />}
            sx={{ borderRadius: 999, ml: 'auto' }}
          >
            Open
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeading({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
      {icon}
      <Typography variant="h3" sx={{ color: 'text.primary' }}>{label}</Typography>
    </Box>
  );
}

export default function StaffLibraryPage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'materials' | 'documents'>('all');
  const [category, setCategory] = useState<string | null>(null);

  const { data: documents, isLoading: docsLoading, error: docsError } = usePortalDocuments();
  const { data: modules, isLoading: modsLoading } = useAssignedModules();
  const { data: categories = [] } = useResourceCategories();

  const materials = useMemo(() => materialsFromModules(modules ?? []), [modules]);

  const needle = search.trim().toLowerCase();
  const filteredMaterials = useMemo(
    () => materials.filter((m) => !needle
      || m.filename.toLowerCase().includes(needle)
      || m.moduleTitle.toLowerCase().includes(needle)),
    [materials, needle],
  );
  const categoryLabels = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.value, c.label])),
    [categories],
  );

  function docCategoryLabel(slug: string): string {
    return slug ? (categoryLabels[slug] ?? slug) : 'General';
  }

  const filteredDocs = useMemo(
    () => (documents ?? []).filter((d) => {
      const slug = d.meta.document_category || '';
      if (category !== null && slug !== category) return false;
      if (!needle) return true;
      return d.title.toLowerCase().includes(needle)
        || docCategoryLabel(slug).toLowerCase().includes(needle);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, needle, category, categoryLabels],
  );

  // Only the categories that actually have something in them, so the strip
  // never offers a filter that lands the staff member on an empty list.
  const docCategories = useMemo(() => {
    const present = new Set((documents ?? []).map((d) => d.meta.document_category || ''));
    return categories.filter((c) => present.has(c.value));
  }, [documents, categories]);

  const isLoading = docsLoading || modsLoading;
  const showMaterials = view === 'all' || view === 'materials';
  const showDocuments = view === 'all' || view === 'documents';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h1">Resources</Typography>

      <TextField
        placeholder="Search resources…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ maxWidth: 400 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_, next) => next && setView(next)}
        sx={{
          flexWrap: 'wrap',
          gap: 1,
          '&& .MuiToggleButtonGroup-grouped': {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '999px !important',
            marginLeft: 0,
            px: { xs: 1.5, sm: 2 },
            py: 0.5,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: { xs: 12, sm: 13 },
            whiteSpace: 'nowrap',
            color: 'text.secondary',
            '&.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'white',
              borderColor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          },
        }}
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="materials">Module Materials</ToggleButton>
        <ToggleButton value="documents">Documents</ToggleButton>
      </ToggleButtonGroup>

      {showDocuments && docCategories.length > 1 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label="All categories"
            onClick={() => setCategory(null)}
            color={category === null ? 'primary' : 'default'}
            variant={category === null ? 'filled' : 'outlined'}
            sx={{ borderRadius: 999 }}
          />
          {docCategories.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              onClick={() => setCategory(c.value)}
              color={category === c.value ? 'primary' : 'default'}
              variant={category === c.value ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Box>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {!!docsError && <Alert severity="error">{(docsError as Error).message}</Alert>}

      {!isLoading && (
        <>
          {showMaterials && (
            <Box component="section">
              <SectionHeading icon={<SchoolOutlinedIcon />} label="Module Materials" />
              {filteredMaterials.length === 0 ? (
                <Typography color="text.secondary">
                  {search ? 'No module materials match your search.' : 'No materials from your assigned modules yet.'}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {filteredMaterials.map((m) => (
                    <ResourceCard
                      key={m.url}
                      icon={<TypeIcon type={m.type} />}
                      title={m.filename}
                      subtitle={`From: ${m.moduleTitle}`}
                      url={m.url}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {showDocuments && (
            <Box component="section">
              <SectionHeading icon={<DescriptionOutlinedIcon />} label="Documents" />
              {filteredDocs.length === 0 ? (
                <Typography color="text.secondary">
                  {search || category
                    ? 'No documents match your search.'
                    : 'No documents available.'}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {filteredDocs.map((d) => (
                    <ResourceCard
                      key={d.id}
                      icon={<DescriptionOutlinedIcon sx={{ color: 'primary.main', flexShrink: 0 }} />}
                      title={d.title}
                      subtitle={docCategoryLabel(d.meta.document_category || '')}
                      url={d.fileUrl}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
