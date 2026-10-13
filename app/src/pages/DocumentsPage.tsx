import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Checkbox, IconButton, InputAdornment, MenuItem, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useMedia, useDeleteMedia } from '../hooks/useMedia';
import {
  useCreateDocument, useDocuments, useSetDocumentVisibility, useUploadMedia,
} from '../hooks/useDocuments';
import { useRoles } from '../hooks/useStaff';
import {
  useResourceCategories,
  useCreateResourceCategory,
  useRenameResourceCategory,
  useDeleteResourceCategory,
  useSetMediaCategory,
  useSetResourceCategoryVisibility,
} from '../hooks/useResourceCategories';
import type { MediaItem, MediaType, MediaUsage } from '../types';

// Filter sentinel for files that are in no category at all. Not a category —
// there is deliberately no way to *file* something here, only to find what
// has fallen out of a category that was renamed away or deleted.
const UNCATEGORISED = '__none';

const TYPE_LABEL: Record<MediaType, string> = {
  image: 'Image', video: 'Video', pdf: 'PDF', other: 'File',
};

const TYPE_CHIP: Record<MediaType, 'info' | 'success' | 'error' | 'default'> = {
  image: 'info', video: 'success', pdf: 'error', other: 'default',
};

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function usageLabel(usage: MediaUsage[]): string {
  return [...new Set(usage.map((u) => u.title))].join(', ');
}

// A file can be two things at once: the document record that wraps it, and the
// modules that embed it. One column holding both read as a list of unrelated
// names, so they are split — Title is what this file is filed as, Used by is
// where it appears.
const documentsOf = (usage: MediaUsage[]) => usage.filter((u) => u.kind === 'document');
const modulesOf = (usage: MediaUsage[]) => usage.filter((u) => u.kind === 'module');

function FileThumb({ item }: { item: MediaItem }) {
  if (item.type === 'image') {
    return (
      <Box
        component="img"
        src={item.url}
        alt=""
        sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  const Icon =
    item.type === 'pdf' ? PictureAsPdfOutlinedIcon
      : item.type === 'video' ? MovieOutlinedIcon
        : InsertDriveFileOutlinedIcon;
  const color = item.type === 'pdf' ? 'error.main' : item.type === 'video' ? 'success.main' : 'text.secondary';
  return (
    <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'grey.100', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Icon sx={{ color }} />
    </Box>
  );
}

function CategoryCell({ item }: { item: MediaItem }) {
  if (!item.category) {
    return <Chip label="Uncategorised" size="small" color="warning" variant="outlined" sx={{ borderRadius: 999 }} />;
  }
  return <Chip label={item.categoryLabel} size="small" variant="outlined" sx={{ borderRadius: 999 }} />;
}

function DocumentTitle({ usage }: { usage: MediaUsage[] }) {
  const docs = documentsOf(usage);
  if (docs.length === 0) {
    // Not a failure: a module image is a file with no document record, which
    // is most of this table.
    return <Typography variant="body2" color="text.disabled">—</Typography>;
  }
  return <Typography variant="body2">{usageLabel(docs)}</Typography>;
}

function UsedBy({ usage }: { usage: MediaUsage[] }) {
  const modules = modulesOf(usage);
  if (modules.length > 0) {
    return <Typography variant="body2">{usageLabel(modules)}</Typography>;
  }
  // The warning is for a file nothing refers to at all — the one that is safe
  // to delete. A document that simply is not in any module is not that.
  if (usage.length === 0) {
    return <Chip label="Not used" size="small" color="warning" variant="outlined" sx={{ borderRadius: 999 }} />;
  }
  return <Typography variant="body2" color="text.disabled">—</Typography>;
}

const headCellSx = {
  py: 2,
  fontWeight: 700,
  borderBottom: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  fontSize: '0.8rem',
};

function StatCard({ icon, iconBg, iconColor, label, value, active, onClick }: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: '2px solid',
        borderColor: active ? 'primary.main' : 'divider',
        borderRadius: 2,
        boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: iconBg, color: iconColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.15 }}>{value}</Typography>
      </Box>
    </Paper>
  );
}

export default function DocumentsPage() {
  const { data: media = [], isLoading, error } = useMedia();
  const deleteMedia = useDeleteMedia();
  const { data: roles = [] } = useRoles();
  const createDocument = useCreateDocument();
  const uploadMedia = useUploadMedia();

  const { data: categories = [] } = useResourceCategories();
  const createCategory = useCreateResourceCategory();
  const renameCategory = useRenameResourceCategory();
  const deleteCategory = useDeleteResourceCategory();
  const setMediaCategory = useSetMediaCategory();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  // Deleting a file quietly detaches any document that pointed at it, so the
  // admin is told rather than finding a document with no file later.
  const [deleteNotice, setDeleteNotice] = useState('');

  // Re-filing one file.
  // Ids rather than items: the list is refetched after every change, and
  // holding stale objects would act on what the screen used to show.
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibilityRoles, setVisibilityRoles] = useState<string[]>(['all']);
  const [visibilityError, setVisibilityError] = useState('');
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MediaItem | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [moveError, setMoveError] = useState('');

  // Managing the list itself.
  const [manageOpen, setManageOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState('');
  const [manageError, setManageError] = useState('');

  const defaultCategory = categories.find((c) => c.protected)?.value
    ?? categories[0]?.value
    ?? '';

  const [uploadOpen, setUploadOpen] = useState(false);
  const [upTitle, setUpTitle] = useState('');
  const [upCategory, setUpCategory] = useState('');
  const [upVisible, setUpVisible] = useState<string[]>(['all']);
  const [upFileName, setUpFileName] = useState('');
  const [upError, setUpError] = useState('');
  const upFileRef = useRef<HTMLInputElement>(null);
  const upFile = useRef<File | null>(null);

  function openUpload() {
    setUpTitle('');
    setUpCategory(defaultCategory);
    setUpVisible(['all']);
    setUpFileName('');
    setUpError('');
    upFile.current = null;
    setUploadOpen(true);
  }

  async function handleUploadSubmit() {
    setUpError('');
    if (!upFile.current) {
      setUpError('Please choose a file to upload.');
      return;
    }
    if (!upVisible.length) {
      setUpError('Choose who can see this document.');
      return;
    }
    try {
      const uploaded = await uploadMedia.mutateAsync(upFile.current);
      await createDocument.mutateAsync({
        title: upTitle.trim() || upFileName || 'Untitled document',
        status: 'publish',
        document_category: upCategory,
        document_file_id: uploaded.id,
        document_role_targets: upVisible,
      });
      setUploadOpen(false);
    } catch (err) {
      setUpError(err instanceof Error ? err.message : 'Could not upload the document.');
    }
  }

  const uploading = uploadMedia.isLoading || createDocument.isLoading;

  const counts = useMemo(() => ({
    total: media.length,
    image: media.filter((m) => m.type === 'image').length,
    video: media.filter((m) => m.type === 'video').length,
    pdf: media.filter((m) => m.type === 'pdf').length,
  }), [media]);

  // Counted off the media list rather than the category endpoint, so the
  // number on a chip always matches the number of rows clicking it produces.
  const categoryCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of media) {
      const key = m.category || UNCATEGORISED;
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [media]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return media.filter((m) => {
      if (typeFilter && m.type !== typeFilter) return false;
      if (categoryFilter === UNCATEGORISED && m.category) return false;
      if (categoryFilter !== null && categoryFilter !== UNCATEGORISED && m.category !== categoryFilter) {
        return false;
      }
      if (!needle) return true;
      return m.filename.toLowerCase().includes(needle)
        || m.categoryLabel.toLowerCase().includes(needle)
        || m.usage.some((u) => u.title.toLowerCase().includes(needle));
    });
  }, [media, search, typeFilter, categoryFilter]);

  function toggleType(t: MediaType) {
    setTypeFilter((cur) => (cur === t ? null : t));
  }

  const setVisibility = useSetDocumentVisibility();

  // A document with no audience is not merely unassigned — staff cannot see
  // it at all, and nothing on this screen said so. It is an easy state to
  // reach: a document imported from an older backup, or created outside the
  // upload dialog, has no targets, and the category manager is where someone
  // goes when wondering why a category looks empty to staff.
  const { data: allDocuments = [] } = useDocuments();
  const hiddenDocs = allDocuments.filter(
    (d) => (d.meta.document_role_targets ?? []).length === 0,
  );
  const hiddenInCategory = (slug: string) =>
    hiddenDocs.filter((d) => (d.meta.document_category || '') === slug).length;
  const hiddenUncategorised = hiddenInCategory('');

  const setCategoryVisibility = useSetResourceCategoryVisibility();

  async function toggleCategoryVisibility(value: string, hidden: boolean) {
    setManageError('');
    try {
      await setCategoryVisibility.mutateAsync({ value, hidden });
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not change the category.');
    }
  }
  const selectedItems = filtered.filter((m) => selectedIds.includes(m.id));
  // Visibility is a property of the document record, not of the file, so a
  // module image in the selection has nothing to set it on.
  const selectedDocumentIds = selectedItems.flatMap((m) => documentsOf(m.usage).map((d) => d.id));
  const allShownSelected = filtered.length > 0 && filtered.every((m) => selectedIds.includes(m.id));
  const selectedInUse = selectedItems.filter((m) => m.usage.length > 0);

  function toggleOne(id: number) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // Only what is on screen: selecting everything should never reach rows the
  // current filter is hiding.
  function toggleAllShown() {
    setSelectedIds(allShownSelected ? [] : filtered.map((m) => m.id));
  }

  function openVisibility() {
    setVisibilityError('');
    setVisibilityRoles(['all']);
    setVisibilityOpen(true);
  }

  async function handleVisibility() {
    if (!visibilityRoles.length) {
      setVisibilityError('Choose who can see these documents.');
      return;
    }
    setVisibilityError('');
    try {
      await setVisibility.mutateAsync({ ids: selectedDocumentIds, roles: visibilityRoles });
      setVisibilityOpen(false);
      setSelectedIds([]);
    } catch (err) {
      setVisibilityError(err instanceof Error ? err.message : 'Could not change visibility.');
    }
  }

  async function handleBulkDelete() {
    setDeleteError('');
    setDeleteNotice('');
    let unlinked = 0;
    try {
      // Sequential, like the other bulk actions: a burst of deletes is exactly
      // what a security plugin throttles, and a half-applied batch is worse
      // than a slow one.
      for (const item of selectedItems) {
        unlinked += (await deleteMedia.mutateAsync(item.id)).documentsUnlinked;
      }
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      if (unlinked > 0) {
        setDeleteNotice(`${unlinked} document(s) pointed at those files and now have no file attached.`);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the files.');
    }
  }

  async function handleBulkCategory(category: string) {
    setMoveError('');
    try {
      for (const item of selectedItems) {
        await setMediaCategory.mutateAsync({ id: item.id, category });
      }
      setBulkCategoryOpen(false);
      setSelectedIds([]);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Could not move the files.');
    }
  }

  function openMove(m: MediaItem) {
    setMoveTarget(m);
    setMoveTo(m.category || defaultCategory);
    setMoveError('');
  }

  async function handleMove() {
    if (!moveTarget) return;
    setMoveError('');
    try {
      await setMediaCategory.mutateAsync({ id: moveTarget.id, category: moveTo });
      setMoveTarget(null);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Could not move the file.');
    }
  }

  function openManage() {
    setDrafts(Object.fromEntries(categories.map((c) => [c.value, c.label])));
    setNewCategory('');
    setManageError('');
    setManageOpen(true);
  }

  // Committed on blur rather than behind a save button: the slug never
  // changes, so a rename is a label edit and nothing downstream has to move.
  async function commitRename(value: string, original: string) {
    const next = (drafts[value] ?? '').trim();
    if (!next || next === original) {
      setDrafts((d) => ({ ...d, [value]: original }));
      return;
    }
    setManageError('');
    try {
      await renameCategory.mutateAsync({ value, name: next });
    } catch (err) {
      setDrafts((d) => ({ ...d, [value]: original }));
      setManageError(err instanceof Error ? err.message : 'Could not rename the category.');
    }
  }

  async function handleCreateCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setManageError('');
    try {
      const created = await createCategory.mutateAsync(name);
      setDrafts((d) => ({ ...d, [created.value]: created.label }));
      setNewCategory('');
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not create the category.');
    }
  }

  async function handleDeleteCategory(value: string) {
    setManageError('');
    try {
      await deleteCategory.mutateAsync(value);
      setDrafts((d) => {
        const next = { ...d };
        delete next[value];
        return next;
      });
      if (categoryFilter === value) setCategoryFilter(null);
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not delete the category.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      const { documentsUnlinked } = await deleteMedia.mutateAsync(deleteTarget.id);
      setDeleteNotice(
        documentsUnlinked > 0
          ? `${documentsUnlinked} document(s) pointed at that file and now have no file attached.`
          : '',
      );
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the file.');
    }
  }

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">Error: {(error as Error).message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '2rem' }}>Documents</Typography>
          <Typography color="text.secondary">View and manage all uploaded files</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<FolderOutlinedIcon />}
            onClick={openManage}
            sx={{ borderRadius: 999 }}
          >
            Manage Categories
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFileOutlinedIcon />}
            onClick={openUpload}
            sx={{ borderRadius: 999 }}
          >
            Upload Document
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        <StatCard icon={<DescriptionOutlinedIcon />} iconBg="rgba(59, 130, 246, 0.12)" iconColor="#3b82f6" label="Total files" value={counts.total} active={typeFilter === null} onClick={() => setTypeFilter(null)} />
        <StatCard icon={<ImageOutlinedIcon />} iconBg="rgba(168, 85, 247, 0.12)" iconColor="#a855f7" label="Images" value={counts.image} active={typeFilter === 'image'} onClick={() => toggleType('image')} />
        <StatCard icon={<MovieOutlinedIcon />} iconBg="rgba(34, 197, 94, 0.12)" iconColor="#22c55e" label="Videos" value={counts.video} active={typeFilter === 'video'} onClick={() => toggleType('video')} />
        <StatCard icon={<PictureAsPdfOutlinedIcon />} iconBg="rgba(239, 68, 68, 0.12)" iconColor="#ef4444" label="PDFs" value={counts.pdf} active={typeFilter === 'pdf'} onClick={() => toggleType('pdf')} />
      </Box>

      <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)', overflow: 'hidden' }}>
        <Box sx={{ p: 2.5 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            size="small"
            sx={{ width: { xs: '100%', sm: 320 } }}
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

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            <Chip
              label={`All (${media.length})`}
              onClick={() => setCategoryFilter(null)}
              color={categoryFilter === null ? 'primary' : 'default'}
              variant={categoryFilter === null ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
            {categories.map((c) => (
              <Chip
                key={c.value}
                label={`${c.label} (${categoryCounts[c.value] ?? 0})`}
                onClick={() => setCategoryFilter(c.value)}
                color={categoryFilter === c.value ? 'primary' : 'default'}
                variant={categoryFilter === c.value ? 'filled' : 'outlined'}
                sx={{ borderRadius: 999 }}
              />
            ))}
            {/* Only worth offering when something has actually fallen out of
                a category — otherwise it is a chip that always finds nothing. */}
            {!!categoryCounts[UNCATEGORISED] && (
              <Chip
                label={`Uncategorised (${categoryCounts[UNCATEGORISED]})`}
                onClick={() => setCategoryFilter(UNCATEGORISED)}
                color={categoryFilter === UNCATEGORISED ? 'warning' : 'default'}
                variant={categoryFilter === UNCATEGORISED ? 'filled' : 'outlined'}
                sx={{ borderRadius: 999 }}
              />
            )}
          </Box>
        </Box>

        {deleteNotice && (
          <Alert severity="info" onClose={() => setDeleteNotice('')} sx={{ m: 2 }}>
            {deleteNotice} They are still listed here, and are hidden from staff until a file is attached.
          </Alert>
        )}

        {selectedIds.length > 0 && (
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
              px: 2, py: 1.5, bgcolor: 'action.hover',
              borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {selectedIds.length} selected
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DriveFileMoveOutlinedIcon />}
              onClick={() => { setMoveTo(defaultCategory); setMoveError(''); setBulkCategoryOpen(true); }}
              sx={{ borderRadius: 999 }}
            >
              Change category
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityOutlinedIcon />}
              onClick={openVisibility}
              // Only documents have a visibility setting; a selection of module
              // images has nothing to change.
              disabled={selectedDocumentIds.length === 0}
              sx={{ borderRadius: 999 }}
            >
              Change visibility
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => { setDeleteError(''); setBulkDeleteOpen(true); }}
              sx={{ borderRadius: 999 }}
            >
              Delete
            </Button>
            <Button size="small" onClick={() => setSelectedIds([])}>Clear</Button>
          </Box>
        )}

        <Box sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 48 }} padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allShownSelected}
                    indeterminate={selectedIds.length > 0 && !allShownSelected}
                    onChange={toggleAllShown}
                    slotProps={{ input: { 'aria-label': 'Select all files shown' } }}
                  />
                </TableCell>
                <TableCell sx={headCellSx}>File Name</TableCell>
                <TableCell sx={headCellSx}>Title</TableCell>
                <TableCell sx={headCellSx}>Category</TableCell>
                <TableCell sx={headCellSx}>Used by</TableCell>
                <TableCell sx={headCellSx}>Uploaded</TableCell>
                <TableCell sx={headCellSx}>Size</TableCell>
                <TableCell sx={headCellSx} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  hover
                  selected={selectedIds.includes(m.id)}
                  sx={{ '& td': { py: 1.5, borderBottom: '1px solid', borderColor: 'divider' } }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleOne(m.id)}
                      slotProps={{ input: { 'aria-label': `Select ${m.filename}` } }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <FileThumb item={m} />
                      <Typography sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{m.filename}</Typography>
                      <Chip label={TYPE_LABEL[m.type]} color={TYPE_CHIP[m.type]} size="small" variant="outlined" sx={{ borderRadius: 999, flexShrink: 0 }} />
                    </Box>
                  </TableCell>
                  <TableCell><DocumentTitle usage={m.usage} /></TableCell>
                  <TableCell><CategoryCell item={m} /></TableCell>
                  <TableCell><UsedBy usage={m.usage} /></TableCell>
                  <TableCell><Typography variant="body2">{formatDate(m.uploadedAt)}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{formatSize(m.size)}</Typography></TableCell>
                  <TableCell align="right">
                    <Tooltip title="Change category">
                      <IconButton size="small" onClick={() => openMove(m)} sx={{ color: 'text.secondary' }}>
                        <DriveFileMoveOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton component="a" href={m.url} download target="_blank" rel="noreferrer" size="small" sx={{ color: 'primary.main' }}>
                        <FileDownloadOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => { setDeleteError(''); setDeleteTarget(m); }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 6 }}>
                    <Typography color="text.secondary">No files match your search.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5, p: 2 }}>
          {filtered.map((m) => (
            <Paper key={m.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Checkbox
                  size="small"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggleOne(m.id)}
                  slotProps={{ input: { 'aria-label': `Select ${m.filename}` } }}
                  sx={{ p: 0.5 }}
                />
                <FileThumb item={m} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, wordBreak: 'break-all' }}>{m.filename}</Typography>
                  <Chip label={TYPE_LABEL[m.type]} color={TYPE_CHIP[m.type]} size="small" variant="outlined" sx={{ borderRadius: 999, mt: 0.5 }} />
                </Box>
              </Box>
              <Box sx={{ mt: 1.5, display: 'grid', gap: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Title</Typography>
                  <Box sx={{ textAlign: 'right', minWidth: 0 }}><DocumentTitle usage={m.usage} /></Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Category</Typography>
                  <CategoryCell item={m} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Used by</Typography>
                  <Box sx={{ textAlign: 'right' }}><UsedBy usage={m.usage} /></Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Uploaded</Typography>
                  <Typography variant="body2">{formatDate(m.uploadedAt)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Size</Typography>
                  <Typography variant="body2">{formatSize(m.size)}</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                <Button component="a" href={m.url} download target="_blank" rel="noreferrer" size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} sx={{ borderRadius: 999 }}>
                  Download
                </Button>
                <Button size="small" variant="outlined" startIcon={<DriveFileMoveOutlinedIcon />} onClick={() => openMove(m)} sx={{ borderRadius: 999 }}>
                  Move
                </Button>
                <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { setDeleteError(''); setDeleteTarget(m); }} sx={{ borderRadius: 999 }}>
                  Delete
                </Button>
              </Box>
            </Paper>
          ))}

          {filtered.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No files match your search.
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filtered.length} of {media.length} files
          </Typography>
        </Box>
      </Paper>

      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Delete {selectedIds.length} file{selectedIds.length === 1 ? '' : 's'}?
        </DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          {/* The in-use list is the whole point of the confirmation: deleting
              an unused file is housekeeping, deleting one a module depends on
              breaks that module. Named individually rather than counted, so
              the decision can actually be made here. */}
          {selectedInUse.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {selectedInUse.length} of these are still in use. Deleting them will break:
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                {selectedInUse.map((m) => (
                  <li key={m.id}>
                    <strong style={{ wordBreak: 'break-all' }}>{m.filename}</strong>
                    {' — '}
                    {usageLabel(m.usage)}
                  </li>
                ))}
              </Box>
            </Alert>
          ) : (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              None of these files are used by a module or document.
            </Typography>
          )}
          <Typography color="text.secondary">
            This permanently removes them from WordPress storage. This can&rsquo;t be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} disabled={deleteMedia.isLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleBulkDelete} disabled={deleteMedia.isLoading}>
            {deleteMedia.isLoading ? 'Deleting…' : `Delete ${selectedIds.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this file?</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          {deleteTarget && deleteTarget.usage.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This file is still in use. Deleting it will break these places:
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                {deleteTarget.usage.map((u, i) => (
                  <li key={`${u.kind}-${u.id}-${u.where ?? ''}-${i}`}>
                    <strong>{u.title}</strong>
                    {u.where ? ` — ${u.where}` : ''}
                  </li>
                ))}
              </Box>
            </Alert>
          ) : (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              This file is not used by any module or document.
            </Typography>
          )}
          <Typography color="text.secondary">
            This permanently removes <strong>{deleteTarget?.filename}</strong> from WordPress storage. This can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteMedia.isLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteMedia.isLoading}>
            {deleteMedia.isLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkCategoryOpen} onClose={() => setBulkCategoryOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change category</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {moveError && <Alert severity="error" sx={{ mb: 2 }}>{moveError}</Alert>}
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {selectedIds.length} file{selectedIds.length === 1 ? '' : 's'} will be moved.
          </Typography>
          <TextField
            select
            label="Category"
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            fullWidth
          >
            {categories.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
            <MenuItem value="">Uncategorised</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setBulkCategoryOpen(false)} disabled={setMediaCategory.isLoading}>Cancel</Button>
          <Button variant="contained" onClick={() => handleBulkCategory(moveTo)} disabled={setMediaCategory.isLoading}>
            {setMediaCategory.isLoading ? 'Moving…' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={visibilityOpen} onClose={() => setVisibilityOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change visibility</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {visibilityError && <Alert severity="error" sx={{ mb: 2 }}>{visibilityError}</Alert>}
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {selectedDocumentIds.length} document{selectedDocumentIds.length === 1 ? '' : 's'} will be updated.
          </Typography>
          {/* Said plainly rather than left to be discovered: visibility lives
              on the document record, so a selection that includes module
              images changes fewer things than it looks like it will. */}
          {selectedIds.length > selectedDocumentIds.length && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {selectedIds.length - selectedDocumentIds.length} of the selected file(s) are not
              documents — they have no visibility setting and will be left alone.
            </Alert>
          )}
          <TextField
            select
            label="Visible to"
            value={visibilityRoles}
            onChange={(e) => setVisibilityRoles(e.target.value as unknown as string[])}
            helperText="Everyone, or specific staff roles"
            fullWidth
            slotProps={{
              select: {
                multiple: true,
                renderValue: (selected: unknown) =>
                  (selected as string[])
                    .map((v) => (v === 'all' ? 'Everyone' : roles.find((r) => r.value === v)?.label ?? v))
                    .join(', '),
              },
            }}
          >
            <MenuItem value="all">Everyone</MenuItem>
            {roles.map((r) => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setVisibilityOpen(false)} disabled={setVisibility.isLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleVisibility} disabled={setVisibility.isLoading}>
            {setVisibility.isLoading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveTarget !== null} onClose={() => setMoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Change category</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {moveError && <Alert severity="error" sx={{ mb: 2 }}>{moveError}</Alert>}
          <Typography color="text.secondary" sx={{ mb: 2, wordBreak: 'break-all' }}>
            {moveTarget?.filename}
          </Typography>
          <TextField
            select
            label="Category"
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            fullWidth
          >
            {categories.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
            <MenuItem value="">Uncategorised</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setMoveTarget(null)} disabled={setMediaCategory.isLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleMove} disabled={setMediaCategory.isLoading}>
            {setMediaCategory.isLoading ? 'Moving…' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manageOpen} onClose={() => setManageOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resource categories</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {manageError && <Alert severity="error" sx={{ mb: 2 }}>{manageError}</Alert>}
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Renaming a category re-labels it everywhere; the files in it stay put. A
            category can only be deleted once it is empty. Hiding one keeps its
            documents out of the staff portal without changing who each document is
            for, so showing it again brings back exactly what was there.
          </Typography>

          {hiddenDocs.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {hiddenDocs.length} document{hiddenDocs.length === 1 ? ' has' : 's have'} no
              audience set, so no staff member can see
              {hiddenDocs.length === 1 ? ' it' : ' them'}.
              {hiddenUncategorised > 0 && ` ${hiddenUncategorised} of those are uncategorised.`}
              {' '}Select the files in the list behind this dialog and use{' '}
              <strong>Change visibility</strong> to set who they are for.
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {categories.map((c) => (
              <Box key={c.value} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  value={drafts[c.value] ?? c.label}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.value]: e.target.value }))}
                  onBlur={() => commitRename(c.value, c.label)}
                  fullWidth
                />
                <Chip label={`${c.count} file${c.count === 1 ? '' : 's'}`} size="small" variant="outlined" sx={{ borderRadius: 999, flexShrink: 0 }} />
                {hiddenInCategory(c.value) > 0 && (
                  <Chip
                    label={`${hiddenInCategory(c.value)} hidden`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ borderRadius: 999, flexShrink: 0 }}
                  />
                )}
                <Tooltip title={c.hidden ? 'Hidden from staff — click to show' : 'Visible to staff — click to hide'}>
                  <span>
                    <IconButton
                      size="small"
                      color={c.hidden ? 'warning' : 'default'}
                      disabled={setCategoryVisibility.isLoading}
                      onClick={() => toggleCategoryVisibility(c.value, !c.hidden)}
                      aria-label={
                        c.hidden
                          ? `Show ${c.label} to staff`
                          : `Hide ${c.label} from staff`
                      }
                    >
                      {c.hidden
                        ? <VisibilityOffOutlinedIcon fontSize="small" />
                        : <VisibilityOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    c.protected ? 'Built-in category'
                      : c.count > 0 ? 'Move its files out first'
                        : 'Delete category'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={c.protected || c.count > 0 || deleteCategory.isLoading}
                      onClick={() => handleDeleteCategory(c.value)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
            <TextField
              size="small"
              label="New category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } }}
              fullWidth
            />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateCategory}
              disabled={!newCategory.trim() || createCategory.isLoading}
              sx={{ borderRadius: 999, flexShrink: 0 }}
            >
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setManageOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {upError && <Alert severity="error">{upError}</Alert>}
          <Box>
            <Button
              variant="outlined"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={() => upFileRef.current?.click()}
              sx={{ borderRadius: 999 }}
            >
              {upFileName ? 'Change file' : 'Choose file'}
            </Button>
            {upFileName && (
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>{upFileName}</Typography>
            )}
            <input
              ref={upFileRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                upFile.current = f;
                setUpFileName(f?.name ?? '');
                if (f && !upTitle) setUpTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </Box>
          <TextField label="Title" value={upTitle} onChange={(e) => setUpTitle(e.target.value)} fullWidth />
          <TextField
            select
            label="Category"
            value={upCategory}
            onChange={(e) => setUpCategory(e.target.value)}
            helperText="Manage the list from Manage Categories"
            fullWidth
          >
            {categories.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Visible to"
            value={upVisible}
            onChange={(e) => setUpVisible(e.target.value as unknown as string[])}
            helperText="Everyone, or specific staff roles"
            fullWidth
            slotProps={{
              select: {
                multiple: true,
                renderValue: (selected: unknown) =>
                  (selected as string[])
                    .map((v) => (v === 'all' ? 'Everyone' : roles.find((r) => r.value === v)?.label ?? v))
                    .join(', '),
              },
            }}
          >
            <MenuItem value="all">Everyone</MenuItem>
            {roles.map((r) => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
          <Button variant="contained" onClick={handleUploadSubmit} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
