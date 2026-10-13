import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { usePortalDocuments } from '../../hooks/usePortal';
import { useResourceCategories } from '../../hooks/useResourceCategories';
import { fileTypeLabel } from '../../util/mediaType';
import type { MediaType } from '../../types';

// Every resource used to arrive behind the same page icon, so a video and a
// spreadsheet were both "a document" until you clicked one. Same icons and
// colours the admin media list uses, so the two screens describe a file the
// same way.
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
  const [category, setCategory] = useState<string | null>(null);

  const { data: documents, isLoading: docsLoading, error: docsError } = usePortalDocuments();
  const { data: categories = [] } = useResourceCategories();

  const needle = search.trim().toLowerCase();
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

  const isLoading = docsLoading;

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

      {docCategories.length > 1 && (
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
          {(
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
                      icon={<TypeIcon type={d.fileType ?? 'other'} />}
                      title={d.title}
                      // Type first: it is what decides whether this is worth
                      // opening on a phone right now.
                      subtitle={[
                        fileTypeLabel(d.fileType ?? 'other', d.fileUrl),
                        docCategoryLabel(d.meta.document_category || ''),
                      ].filter(Boolean).join(' · ')}
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
