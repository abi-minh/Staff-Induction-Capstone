import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import { useLocations, useCreateLocation, useDeleteLocation } from '../hooks/useLocations';
import type { ClassLocation } from '../types';

export default function LocationsPage() {
  const { data: locations = [], isLoading, error } = useLocations('any');
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const navigate = useNavigate();

  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [addError, setAddError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ClassLocation | null>(null);

  // A new location starts as a draft and goes straight to the editor: the map
  // pin and markers are the real work, and there's nothing worth publishing
  // before they exist.
  async function handleCreate() {
    setAddError('');
    if (!newTitle.trim()) {
      setAddError('Give the location a name.');
      return;
    }
    try {
      const created = await createLocation.mutateAsync({
        title: newTitle.trim(),
        address: newAddress.trim(),
        status: 'draft',
      });
      setAddOpen(false);
      setNewTitle('');
      setNewAddress('');
      navigate(`/locations/${created.id}`);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not create the location.');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteLocation.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;

  return (
    <>
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
          <Typography variant="h1">Locations</Typography>
          <Chip label={`${locations.length} total`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        </Box>
        <Button
          variant="contained"
          startIcon={<AddLocationAltIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ borderRadius: 999 }}
        >
          Add Location
        </Button>
      </Box>

      {locations.length === 0 ? (
        <Typography color="text.secondary">
          No locations yet. Add one to pin it on the map for staff.
        </Typography>
      ) : (
        <Paper
          sx={{
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                {['Location', 'Address', 'Markers', 'Status', ''].map((label, i) => (
                  <TableCell
                    key={label || i}
                    sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((location) => (
                <TableRow
                  key={location.id}
                  hover
                  sx={{ '& td': { py: 1.5, borderBottom: '1px solid', borderColor: 'divider' } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        src={location.thumbnailUrl || undefined}
                        variant="rounded"
                        sx={{ width: 52, height: 40, bgcolor: 'primary.main' }}
                      >
                        <PlaceIcon fontSize="small" />
                      </Avatar>
                      <Link
                        component={RouterLink}
                        to={`/locations/${location.id}`}
                        sx={{ fontWeight: 500 }}
                      >
                        {location.title || '(Untitled)'}
                      </Link>
                    </Box>
                  </TableCell>
                  <TableCell>{location.address || '-'}</TableCell>
                  <TableCell>{location.markers.length}</TableCell>
                  <TableCell>
                    <Chip
                      label={location.status === 'publish' ? 'Published' : 'Draft'}
                      size="small"
                      color={location.status === 'publish' ? 'success' : 'default'}
                      variant={location.status === 'publish' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete location">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setConfirmDelete(location)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add location</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            fullWidth
            helperText="You can look this up on the map in the next step."
          />
          {addError && <Alert severity="error" sx={{ mt: 2 }}>{addError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAddOpen(false)} disabled={createLocation.isLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={createLocation.isLoading}>
            {createLocation.isLoading ? 'Creating…' : 'Create & edit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete location?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            "{confirmDelete?.title}" will be permanently deleted, along with its map
            markers and notes. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleteLocation.isLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteLocation.isLoading}
          >
            {deleteLocation.isLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
