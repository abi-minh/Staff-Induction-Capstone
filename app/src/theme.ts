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
