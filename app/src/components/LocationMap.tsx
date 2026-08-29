import { useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, LayersControl,
  useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Typography } from '@mui/material';
import { MARKER_COLORS } from '../util/markerColors';
import type { LocationMarker, LocationPath, MarkerColor } from '../types';

// Dashed, like the route drawn on the wireframe.
const PATH_DASH = '12 10';

// A hollow ring, the way the annotations are drawn on the wireframe. Built as a
// divIcon rather than an image file: Leaflet's default marker PNGs resolve to
// 404s under a bundler, and a ring recolours from the palette for free.
function ringIcon(color: MarkerColor): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<span style="display:block;width:34px;height:34px;border-radius:50%;` +
      `border:4px solid ${MARKER_COLORS[color]};` +
      `box-shadow:0 0 0 2px rgba(255,255,255,0.55)"></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Leaflet owns the view once the map is created, so prop changes (a geocoded
// address, a different location selected) have to be pushed in explicitly.
function ViewSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MapEvents({
  onMapClick,
  onViewChange,
}: {
  onMapClick?: (lat: number, lng: number) => void;
  onViewChange?: (center: [number, number], zoom: number) => void;
}) {
  const map = useMapEvents({
    click: (e) => onMapClick?.(e.latlng.lat, e.latlng.lng),
    moveend: () => onViewChange?.([map.getCenter().lat, map.getCenter().lng], map.getZoom()),
    zoomend: () => onViewChange?.([map.getCenter().lat, map.getCenter().lng], map.getZoom()),
  });
  return null;
}

interface LegendEntry {
  key: string;
  label: string;
  color: MarkerColor;
  dashed: boolean;
}

interface Props {
  center: [number, number];
  zoom: number;
  markers: LocationMarker[];
  paths?: LocationPath[];
  height?: number | string;
  /** Click to drop a pin or extend the line being drawn; drag to move a pin. */
  editable?: boolean;
  /** Shows the vertices of this line so they can be seen while drawing. */
  activePathId?: string | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerMove?: (id: string, lat: number, lng: number) => void;
  onViewChange?: (center: [number, number], zoom: number) => void;
}

export default function LocationMap({
  center,
  zoom,
  markers,
  paths = [],
  height = 420,
  editable = false,
  activePathId = null,
  onMapClick,
  onMarkerMove,
  onViewChange,
}: Props) {
  // One legend row per distinct label/colour pair — the key the wireframe shows
  // bottom-left ("Meeting point" ring, "Where to fish" dashed line).
  const entries: LegendEntry[] = [
    ...markers.map((m) => ({ key: m.id, label: m.label, color: m.color, dashed: false })),
    ...paths.map((p) => ({ key: p.id, label: p.label, color: p.color, dashed: true })),
  ];
  const legend = entries
    .filter((e) => e.label)
    .filter(
      (e, i, all) =>
        all.findIndex((o) => o.label === e.label && o.color === e.color && o.dashed === e.dashed) === i,
    );

  const activePath = paths.find((p) => p.id === activePathId);

  return (
    <Box sx={{ position: 'relative', height, borderRadius: 2, overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <ViewSync center={center} zoom={zoom} />
        <MapEvents onMapClick={editable ? onMapClick : undefined} onViewChange={onViewChange} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street map">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {paths.map((path) => (
          <Polyline
            key={path.id}
            positions={path.points}
            pathOptions={{
              color: MARKER_COLORS[path.color],
              weight: 5,
              dashArray: PATH_DASH,
              opacity: 0.95,
            }}
          >
            {path.label && <Tooltip sticky>{path.label}</Tooltip>}
          </Polyline>
        ))}

        {/* Vertices of the line currently being drawn, so its shape is editable
            by eye rather than by guesswork. */}
        {activePath?.points.map((point, index) => (
          <CircleMarker
            key={`${activePath.id}-${index}`}
            center={point}
            radius={5}
            pathOptions={{
              color: '#FFFFFF',
              weight: 2,
              fillColor: MARKER_COLORS[activePath.color],
              fillOpacity: 1,
            }}
          />
        ))}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={ringIcon(marker.color)}
            draggable={editable}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onMarkerMove?.(marker.id, lat, lng);
              },
            }}
          >
            {marker.label && <Tooltip direction="top">{marker.label}</Tooltip>}
          </Marker>
        ))}
      </MapContainer>

      {legend.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            left: 16,
            bottom: 24,
            zIndex: 1000,
            px: 1.75,
            py: 1.25,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.92)',
            boxShadow: '0 10px 30px rgba(15,23,42,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
          }}
        >
          {legend.map((entry) => (
            <Box key={entry.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {entry.dashed ? (
                <Box
                  sx={{
                    width: 22,
                    height: 0,
                    borderTop: `4px dashed ${MARKER_COLORS[entry.color]}`,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `3px solid ${MARKER_COLORS[entry.color]}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {entry.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
