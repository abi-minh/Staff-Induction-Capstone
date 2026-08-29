import type { MarkerColor } from '../types';

// Palette shared with INDUCTION_LOCATION_MARKER_COLORS in the plugin PHP: a
// marker colour outside this set is rewritten to 'red' on save. Kept in its own
// module so both the map and the marker editor can import it without tripping
// the "only export components" fast-refresh rule.
export const MARKER_COLORS: Record<MarkerColor, string> = {
  red: '#DC2626',
  amber: '#F59E0B',
  blue: '#2563EB',
  green: '#16A34A',
};

export const MARKER_COLOR_KEYS = Object.keys(MARKER_COLORS) as MarkerColor[];
