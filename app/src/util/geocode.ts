export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

// Nominatim is OpenStreetMap's free geocoder — no key, but a hard 1 req/sec
// policy, so this is only ever called from an explicit "Find on map" click,
// never on keystroke. Deliberately uses plain fetch rather than the app's axios
// client: that client attaches the WordPress JWT to every request, which has no
// business being sent to a third party.
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Address lookup failed (${response.status}).`);
  }

  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  if (!Array.isArray(results) || results.length === 0) return null;

  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    displayName: results[0].display_name,
  };
}
