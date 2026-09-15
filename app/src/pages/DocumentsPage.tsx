import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, MenuItem, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useMedia, useDeleteMedia } from '../hooks/useMedia';
import { useCreateDocument, useUploadMedia } from '../hooks/useDocuments';
import { useRoles } from '../hooks/useStaff';
import {
  useResourceCategories,
  useCreateResourceCategory,
  useRenameResourceCategory,
  useDeleteResourceCategory,
  useSetMediaCategory,
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

function UsedBy({ usage }: { usage: MediaUsage[] }) {
  if (usage.length === 0) {
    return <Chip label="Not used" size="small" color="warning" variant="outlined" sx={{ borderRadius: 999 }} />;
  }
  return <Typography variant="body2">{usageLabel(usage)}</Typography>;
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

  // Re-filing one file.
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
      await deleteMedia.mutateAsync(deleteTarget.id);
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

        <Box sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>File Name</TableCell>
                <TableCell sx={headCellSx}>Category</TableCell>
                <TableCell sx={headCellSx}>Used by</TableCell>
                <TableCell sx={headCellSx}>Uploaded</TableCell>
                <TableCell sx={headCellSx}>Size</TableCell>
                <TableCell sx={headCellSx} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} hover sx={{ '& td': { py: 1.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <FileThumb item={m} />
                      <Typography sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{m.filename}</Typography>
                      <Chip label={TYPE_LABEL[m.type]} color={TYPE_CHIP[m.type]} size="small" variant="outlined" sx={{ borderRadius: 999, flexShrink: 0 }} />
                    </Box>
                  </TableCell>
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
                  <TableCell colSpan={6} sx={{ py: 6 }}>
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
                <FileThumb item={m} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, wordBreak: 'break-all' }}>{m.filename}</Typography>
                  <Chip label={TYPE_LABEL[m.type]} color={TYPE_CHIP[m.type]} size="small" variant="outlined" sx={{ borderRadius: 999, mt: 0.5 }} />
                </Box>
              </Box>
              <Box sx={{ mt: 1.5, display: 'grid', gap: 0.75 }}>
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
            category can only be deleted once it is empty.
          </Typography>

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
