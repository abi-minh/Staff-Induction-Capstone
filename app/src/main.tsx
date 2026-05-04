import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import App from './App';
import { theme } from './theme';
import './index.css';

const mountEl =
  document.getElementById('induction-app-root') ??
  document.getElementById('root');

ReactDOM.createRoot(mountEl!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
