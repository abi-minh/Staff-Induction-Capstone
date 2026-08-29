import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, ButtonBase, CircularProgress, IconButton, MenuItem, Paper,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import LocationMap from '../components/LocationMap';
import { MARKER_COLORS, MARKER_COLOR_KEYS } from '../util/markerColors';
import TextBlockEditor from '../blocks/editors/TextBlockEditor';
import { useLocation, useUpdateLocation } from '../hooks/useLocations';
import { useUploadMedia } from '../hooks/useDocuments';
import { DEFAULT_ZOOM } from '../api/locations';
import { geocodeAddress } from '../util/geocode';
import type { LocationMarker, LocationPath, MarkerColor } from '../types';

// Only a starting view for a location that has never been pinned — the admin
// geocodes the address or clicks the map, and that becomes the saved centre.
const FALLBACK_CENTER: [number, number] = [-27.4698, 153.0251];

const LABEL_MAX_LENGTH = 60;

// What a map click does. Dropping pins is the common case, so it's the default.
type DrawMode = 'marker' | 'line';

export default function LocationEditPage() {
  const { id } = useParams<{ id: string }>();
  const locationId = Number(id);

  const { data: location, isLoading, error } = useLocation(locationId);
  const updateLocation = useUpdateLocation();
  const uploadMedia = useUploadMedia();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'publish' | 'draft'>('draft');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [paths, setPaths] = useState<LocationPath[]>([]);
  const [mode, setMode] = useState<DrawMode>('marker');
  // The line clicks currently extend. Null means the next click in line mode
  // starts a new one.
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [thumbnailId, setThumbnailId] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // `center`/`zoom` drive the map; the ref holds wherever the admin has since
  // panned to. Feeding map movement back into the props would fight the map's
  // own view, so the pan/zoom result is read from the ref at save time instead.
  const [center, setCenter] = useState<[number, number]>(FALLBACK_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const viewRef = useRef({ center: FALLBACK_CENTER, zoom: DEFAULT_ZOOM });

  const [editorKey, setEditorKey] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const thumbnailFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!location) return;
    setTitle(location.title);
    setStatus(location.status);
    setAddress(location.address);
    setNotes(location.notes);
    setMarkers(location.markers);
    setPaths(location.paths);
    setActivePathId(null);
    setThumbnailId(location.thumbnailId);
    setThumbnailUrl(location.thumbnailUrl);
    setEditorKey((key) => key + 1);

    const pinned: [number, number] =
      location.lat || location.lng ? [location.lat, location.lng] : FALLBACK_CENTER;
    setCenter(pinned);
    setZoom(location.zoom || DEFAULT_ZOOM);
    viewRef.current = { center: pinned, zoom: location.zoom || DEFAULT_ZOOM };
  }, [location]);

  async function handleFindOnMap() {
    setGeoError('');
    setGeoBusy(true);
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        setGeoError('No match for that address. Click the map to place it manually.');
        return;
      }
      const found: [number, number] = [result.lat, result.lng];
      setCenter(found);
      setZoom(DEFAULT_ZOOM);
      viewRef.current = { center: found, zoom: DEFAULT_ZOOM };
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Address lookup failed.');
    } finally {
      setGeoBusy(false);
    }
  }

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    setThumbnailId(media.id);
    setThumbnailUrl(media.sourceUrl);
  }

  function handleMapClick(lat: number, lng: number) {
    if (mode === 'line') {
      extendLine(lat, lng);
      return;
    }
    setMarkers((current) => [
      ...current,
      {
        // Cycles the palette so consecutive pins are visually distinct without
        // the admin having to pick a colour first.
        id: `m${Date.now()}`,
        lat,
        lng,
        label: '',
        color: MARKER_COLOR_KEYS[current.length % MARKER_COLOR_KEYS.length],
      },
    ]);
  }

  // Each click in line mode appends a point to the active line, starting a new
  // one if there isn't one yet. Amber by default, matching the wireframe's
  // "where to fish" route.
  function extendLine(lat: number, lng: number) {
    if (!activePathId) {
      const newPath: LocationPath = {
        id: `p${Date.now()}`,
        label: 'Where to fish',
        color: 'amber',
        points: [[lat, lng]],
      };
      setPaths((current) => [...current, newPath]);
      setActivePathId(newPath.id);
      return;
    }
    setPaths((current) =>
      current.map((path) =>
        path.id === activePathId ? { ...path, points: [...path.points, [lat, lng]] } : path,
      ),
    );
  }

  function updatePath(pathId: string, patch: Partial<LocationPath>) {
    setPaths((current) => current.map((p) => (p.id === pathId ? { ...p, ...patch } : p)));
  }

  function undoLastPoint() {
    if (!activePathId) return;
    setPaths((current) =>
      current.map((path) =>
        path.id === activePathId ? { ...path, points: path.points.slice(0, -1) } : path,
      ),
    );
  }

  function updateMarker(markerId: string, patch: Partial<LocationMarker>) {
    setMarkers((current) =>
      current.map((m) => (m.id === markerId ? { ...m, ...patch } : m)),
    );
  }

  async function handleSave() {
    setSaveError('');
    setSaved(false);
    try {
      await updateLocation.mutateAsync({
        id: locationId,
        values: {
          title,
          status,
          address,
          lat: viewRef.current.center[0],
          lng: viewRef.current.center[1],
          zoom: viewRef.current.zoom,
          thumbnailId,
          notes,
          markers,
          // A one-point line can't be drawn and the server drops it anyway;
          // discarding it here keeps what's saved and what's shown in step.
          paths: paths.filter((path) => path.points.length >= 2),
        },
      });
      setPaths((current) => current.filter((path) => path.points.length >= 2));
      setActivePathId(null);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the location.');
    }
  }

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!location) return <Alert severity="warning">Location not found.</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton component={RouterLink} to="/locations" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h1">{title || '(Untitled location)'}</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Details */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, width: { xs: '100%', md: 380 } }}>
          <TextField
            label="Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />

          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            sx={{ mb: 1 }}
          />
          <Button
            size="small"
            startIcon={geoBusy ? <CircularProgress size={14} /> : <TravelExploreIcon />}
            onClick={handleFindOnMap}
            disabled={geoBusy || !address.trim()}
            sx={{ mb: geoError ? 1 : 2 }}
          >
            Find on map
          </Button>
          {geoError && <Alert severity="warning" sx={{ mb: 2 }}>{geoError}</Alert>}

          <TextField
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'publish' | 'draft')}
            select
            fullWidth
            helperText="Only published locations appear in the staff portal."
            sx={{ mb: 2 }}
          >
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="publish">Published</MenuItem>
          </TextField>

          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            List thumbnail
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 96,
                height: 64,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.100',
                backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                flexShrink: 0,
              }}
            />
            <Box>
              <Button size="small" variant="outlined" onClick={() => thumbnailFileRef.current?.click()}>
                {thumbnailUrl ? 'Replace' : 'Choose image'}
              </Button>
              {thumbnailUrl && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setThumbnailId(0);
                    setThumbnailUrl('');
                  }}
                >
                  Remove
                </Button>
              )}
              {uploadMedia.isLoading && (
                <Typography variant="caption" color="text.secondary" component="div">
                  Uploading…
                </Typography>
              )}
            </Box>
            <input
              ref={thumbnailFileRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleThumbnailUpload}
            />
          </Box>

          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Notes
          </Typography>
          <TextBlockEditor
            key={editorKey}
            block={{ id: 'location-notes', type: 'text', data: { html: notes } }}
            onChange={(data) => setNotes(data.html)}
          />

          {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
          {saved && <Alert severity="success" sx={{ mt: 2 }}>Location saved.</Alert>}

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={updateLocation.isLoading}
            sx={{ mt: 2 }}
          >
            {updateLocation.isLoading ? 'Saving…' : 'Save location'}
          </Button>
        </Paper>

        {/* Map + markers */}
        <Box sx={{ flex: 1, minWidth: 320 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_e, next: DrawMode | null) => {
                if (!next) return;
                setMode(next);
                // Leaving line mode ends the line being drawn, so coming back
                // starts a fresh one instead of silently extending the old.
                if (next === 'marker') setActivePathId(null);
              }}
            >
              <ToggleButton value="marker" sx={{ textTransform: 'none' }}>
                Drop markers
              </ToggleButton>
              <ToggleButton value="line" sx={{ textTransform: 'none' }}>
                Draw a line
              </ToggleButton>
            </ToggleButtonGroup>

            {mode === 'line' && activePathId && (
              <>
                <Button size="small" onClick={undoLastPoint}>
                  Undo point
                </Button>
                <Button size="small" variant="outlined" onClick={() => setActivePathId(null)}>
                  Finish line
                </Button>
              </>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {mode === 'marker'
              ? "Click the map to drop a marker; drag a marker to move it. The map's current centre and zoom are what staff will see."
              : 'Click along the route to add points — each click extends the line. Finish it, then start another for a second route.'}
          </Typography>

          <LocationMap
            center={center}
            zoom={zoom}
            markers={markers}
            paths={paths}
            height={460}
            editable
            activePathId={activePathId}
            onMapClick={handleMapClick}
            onMarkerMove={(markerId, lat, lng) => updateMarker(markerId, { lat, lng })}
            onViewChange={(nextCenter, nextZoom) => {
              viewRef.current = { center: nextCenter, zoom: nextZoom };
            }}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Markers ({markers.length})
            </Typography>

            {markers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No markers yet. Click the map to add one.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {markers.map((marker) => (
                  <Paper
                    key={marker.id}
                    variant="outlined"
                    sx={{ p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
                  >
                    <TextField
                      size="small"
                      placeholder="Label (e.g. Meeting point)"
                      value={marker.label}
                      onChange={(e) =>
                        updateMarker(marker.id, {
                          label: e.target.value.slice(0, LABEL_MAX_LENGTH),
                        })
                      }
                      sx={{ flex: 1, minWidth: 180 }}
                    />

                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      {MARKER_COLOR_KEYS.map((color) => (
                        <Tooltip key={color} title={color}>
                          <ButtonBase
                            onClick={() => updateMarker(marker.id, { color })}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              border: `3px solid ${MARKER_COLORS[color as MarkerColor]}`,
                              bgcolor: marker.color === color ? MARKER_COLORS[color as MarkerColor] : 'transparent',
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                      {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                    </Typography>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setMarkers((current) => current.filter((m) => m.id !== marker.id))}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
                <Typography variant="caption" color="text.secondary">
                  Labelled markers appear in the map legend staff see; unlabelled
                  ones are drawn without a legend entry.
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Lines ({paths.length})
            </Typography>

            {paths.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No lines yet. Switch to "Draw a line" and click along the route.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {paths.map((path) => (
                  <Paper
                    key={path.id}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                      borderColor: path.id === activePathId ? 'primary.main' : 'divider',
                    }}
                  >
                    <TextField
                      size="small"
                      placeholder="Label (e.g. Where to fish)"
                      value={path.label}
                      onChange={(e) =>
                        updatePath(path.id, { label: e.target.value.slice(0, LABEL_MAX_LENGTH) })
                      }
                      sx={{ flex: 1, minWidth: 180 }}
                    />

                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      {MARKER_COLOR_KEYS.map((color) => (
                        <Tooltip key={color} title={color}>
                          <ButtonBase
                            onClick={() => updatePath(path.id, { color })}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              border: `3px solid ${MARKER_COLORS[color as MarkerColor]}`,
                              bgcolor: path.color === color ? MARKER_COLORS[color as MarkerColor] : 'transparent',
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>

                    <Typography
                      variant="caption"
                      color={path.points.length < 2 ? 'error' : 'text.secondary'}
                      sx={{ minWidth: 80 }}
                    >
                      {path.points.length} point{path.points.length === 1 ? '' : 's'}
                    </Typography>

                    <Button
                      size="small"
                      onClick={() => {
                        setMode('line');
                        setActivePathId(path.id);
                      }}
                      disabled={path.id === activePathId}
                    >
                      {path.id === activePathId ? 'Drawing' : 'Continue'}
                    </Button>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setPaths((current) => current.filter((p) => p.id !== path.id));
                        if (activePathId === path.id) setActivePathId(null);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
                <Typography variant="caption" color="text.secondary">
                  Lines are drawn dashed in their colour. A line needs at least
                  two points — one-point lines are discarded on save.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
