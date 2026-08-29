import { useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, ButtonBase, CircularProgress, InputAdornment, Paper, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import LocationMap from '../../components/LocationMap';
import { useLocations } from '../../hooks/useLocations';
import type { ClassLocation } from '../../types';

function LocationListItem({
  location,
  selected,
  onSelect,
}: {
  location: ClassLocation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ButtonBase
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.25,
        width: '100%',
        textAlign: 'left',
        justifyContent: 'flex-start',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Avatar
        src={location.thumbnailUrl || undefined}
        variant="rounded"
        sx={{ width: 64, height: 48, bgcolor: 'primary.main' }}
      >
        <PlaceIcon fontSize="small" />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }} noWrap>
          {location.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {location.address}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

export default function StaffLocationsPage() {
  const { data: locations = [], isLoading, error } = useLocations('publish');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return locations;
    return locations.filter(
      (l) =>
        l.title.toLowerCase().includes(needle) || l.address.toLowerCase().includes(needle),
    );
  }, [locations, search]);

  // Falling back to the first match keeps the detail pane populated as the
  // search narrows, instead of blanking out whenever the selection filters away.
  const selected =
    filtered.find((l) => l.id === selectedId) ?? filtered[0] ?? null;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h1">Locations</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Where to go, where to meet, and what to know before you arrive.
        </Typography>
      </Box>

      {locations.length === 0 ? (
        <Typography color="text.secondary">No locations have been published yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* List */}
          <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
            <TextField
              placeholder="Search locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              sx={{ mb: 1.5 }}
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
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  No locations match "{search}".
                </Typography>
              ) : (
                filtered.map((location) => (
                  <LocationListItem
                    key={location.id}
                    location={location}
                    selected={selected?.id === location.id}
                    onSelect={() => setSelectedId(location.id)}
                  />
                ))
              )}
            </Paper>
          </Box>

          {/* Detail */}
          {selected && (
            <Box sx={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PlaceIcon sx={{ color: 'error.main', fontSize: 34 }} />
                <Box>
                  <Typography variant="h2">{selected.title}</Typography>
                  {selected.address && (
                    <Typography variant="body2" color="text.secondary">
                      {selected.address}
                    </Typography>
                  )}
                </Box>
              </Box>

              <LocationMap
                key={selected.id}
                center={[selected.lat, selected.lng]}
                zoom={selected.zoom}
                markers={selected.markers}
                paths={selected.paths}
                height={440}
              />

              {selected.notes && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 42, height: 42 }}>
                      <EditNoteOutlinedIcon />
                    </Avatar>
                    <Typography variant="h3">Notes</Typography>
                  </Box>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: 'chipInfo.bg',
                      '& ul, & ol': { pl: 3, my: 0 },
                      '& p': { my: 0.5 },
                    }}
                  >
                    {/* Sanitised with wp_kses_post() on the way into post meta. */}
                    <Box dangerouslySetInnerHTML={{ __html: selected.notes }} />
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
