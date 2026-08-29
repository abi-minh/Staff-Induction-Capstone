import client from './client';
import type {
  ClassLocation, LocationFormValues, LocationMarker, LocationPath, MarkerColor,
} from '../types';

export const DEFAULT_ZOOM = 17;

// Must stay in step with INDUCTION_LOCATION_MARKER_COLORS in the plugin PHP:
// anything outside this list is rewritten server-side.
const MARKER_COLORS: MarkerColor[] = ['red', 'amber', 'blue', 'green'];

function toColor(value: unknown, fallback: MarkerColor): MarkerColor {
  return MARKER_COLORS.includes(value as MarkerColor) ? (value as MarkerColor) : fallback;
}

interface WPLocation {
  id: number;
  title: string;
  status: 'publish' | 'draft';
  address: string;
  lat: number;
  lng: number;
  zoom: number;
  thumbnail_id: number;
  thumbnail_url: string;
  notes: string;
  markers: string;
  paths: string;
}

// Markers and lines live in post meta as JSON strings (the approach
// module_blocks already uses). A malformed value should leave the map empty
// rather than throw.
export function parseMarkers(json: string | undefined): LocationMarker[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((raw): LocationMarker[] => {
      const m = raw as Partial<LocationMarker>;
      if (typeof m?.lat !== 'number' || typeof m?.lng !== 'number') return [];
      return [{
        id: String(m.id ?? `${m.lat},${m.lng}`),
        lat: m.lat,
        lng: m.lng,
        label: String(m.label ?? ''),
        color: toColor(m.color, 'red'),
      }];
    });
  } catch {
    return [];
  }
}

export function parsePaths(json: string | undefined): LocationPath[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((raw, index): LocationPath[] => {
      const p = raw as Partial<LocationPath>;
      if (!Array.isArray(p?.points)) return [];
      const points = p.points.filter(
        (point): point is [number, number] =>
          Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number',
      );
      // A line needs two ends; the server drops these too, but a hand-edited
      // meta value shouldn't be able to crash the map either.
      if (points.length < 2) return [];
      return [{
        id: String(p.id ?? `p${index}`),
        label: String(p.label ?? ''),
        color: toColor(p.color, 'amber'),
        points,
      }];
    });
  } catch {
    return [];
  }
}

function normalise(wp: WPLocation): ClassLocation {
  return {
    id: wp.id,
    title: wp.title ?? '',
    status: wp.status,
    address: wp.address ?? '',
    lat: Number(wp.lat ?? 0),
    lng: Number(wp.lng ?? 0),
    zoom: Number(wp.zoom ?? 0) || DEFAULT_ZOOM,
    thumbnailId: wp.thumbnail_id ?? 0,
    thumbnailUrl: wp.thumbnail_url ?? '',
    notes: wp.notes ?? '',
    markers: parseMarkers(wp.markers),
    paths: parsePaths(wp.paths),
  };
}

function toPayload(values: Partial<LocationFormValues>) {
  return {
    ...(values.title !== undefined && { title: values.title }),
    ...(values.status !== undefined && { status: values.status }),
    ...(values.address !== undefined && { address: values.address }),
    ...(values.lat !== undefined && { lat: values.lat }),
    ...(values.lng !== undefined && { lng: values.lng }),
    ...(values.zoom !== undefined && { zoom: values.zoom }),
    ...(values.thumbnailId !== undefined && { thumbnail_id: values.thumbnailId }),
    ...(values.notes !== undefined && { notes: values.notes }),
    ...(values.markers !== undefined && { markers: JSON.stringify(values.markers) }),
    ...(values.paths !== undefined && { paths: JSON.stringify(values.paths) }),
  };
}

export async function fetchLocations(status: 'publish' | 'any' = 'publish'): Promise<ClassLocation[]> {
  const { data } = await client.get<WPLocation[]>('induction/v1/locations', {
    params: { status },
  });
  return data.map(normalise);
}

export async function fetchLocation(id: number): Promise<ClassLocation> {
  const { data } = await client.get<WPLocation>(`induction/v1/locations/${id}`);
  return normalise(data);
}

export async function createLocation(values: Partial<LocationFormValues>): Promise<ClassLocation> {
  const { data } = await client.post<WPLocation>('induction/v1/locations', toPayload(values));
  return normalise(data);
}

export async function updateLocation(
  id: number,
  values: Partial<LocationFormValues>,
): Promise<ClassLocation> {
  const { data } = await client.post<WPLocation>(`induction/v1/locations/${id}`, toPayload(values));
  return normalise(data);
}

export async function deleteLocation(id: number): Promise<void> {
  await client.delete(`induction/v1/locations/${id}`);
}
