import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    chipDue:  { bg: string; fg: string };
    chipInfo: { bg: string; fg: string };
  }
  interface PaletteOptions {
    chipDue?:  { bg: string; fg: string };
    chipInfo?: { bg: string; fg: string };
  }
}

export const theme = createTheme({
  palette: {
    primary:    { main: '#2563EB' },
    success:    { main: '#16A34A' },
    warning:    { main: '#F59E0B' },
    error:      { main: '#DC2626' },
    background: { default: '#F1F5F9', paper: '#FFFFFF' },
    text:       { primary: '#0F172A', secondary: '#475569' },
    divider:    '#E2E8F0',

    chipDue:  { bg: '#FEE2E2', fg: '#B91C1C' },
    chipInfo: { bg: '#DBEAFE', fg: '#1D4ED8' },
  },

  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h1: { fontSize: '1.9rem',  fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.6rem',  fontWeight: 700 },
    h3: { fontSize: '1.35rem', fontWeight: 600 },
    h4: { fontSize: '1.2rem',  fontWeight: 600 },
    subtitle1: { fontSize: '1.05rem', fontWeight: 500 },
    body1: { fontSize: '1rem',    lineHeight: 1.6 },
    body2: { fontSize: '0.9rem',  lineHeight: 1.55 },
    caption: { fontSize: '0.78rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },

  shape: { borderRadius: 10 },
  spacing: 8,

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 18, paddingBlock: 6 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: { borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' },
      },
    },
  },
});

// Height of AdminLayout's app bar — MUI's default Toolbar on sm and up.
export const APP_BAR_HEIGHT = 64;

// Rendered height of stickyActionBarSx: a medium Button (~38px) plus its
// py: 1.5 padding (24px) and the 1px bottom border. Hard-coded because CSS
// gives a sticky element no way to measure the sticky element above it —
// keep this in step if that bar's padding or control size changes.
export const EDITOR_ACTION_BAR_HEIGHT = 63;

// What anything sticky *inside* an editor page has to clear: both bars above
// it, plus a little breathing room.
export const EDITOR_STICKY_TOP = APP_BAR_HEIGHT + EDITOR_ACTION_BAR_HEIGHT + 16;

// An editor's top action bar. The module and section editors are long enough
// that the save button scrolls out of reach, and scrolling back up to save is
// the kind of friction that turns into unsaved work. On desktop the bar sticks
// under the app bar instead; on mobile it scrolls away as before, where the
// viewport is short enough that a permanently pinned bar costs more room than
// it earns. The negative margin cancels the main content padding so the bar's
// background spans the full width as the page scrolls beneath it.
export const stickyActionBarSx = {
  position: { xs: 'static' as const, md: 'sticky' as const },
  top: { md: APP_BAR_HEIGHT },
  zIndex: (t: { zIndex: { appBar: number } }) => t.zIndex.appBar - 1,
  bgcolor: 'background.default',
  mx: { md: -4 },
  px: { md: 4 },
  py: { md: 1.5 },
  borderBottom: { md: '1px solid' },
  borderColor: { md: 'divider' },
};
