import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const mountEl =
  document.getElementById('induction-admin-root') ??
  document.getElementById('root');

if (!mountEl) {
  throw new Error('Mount element not found. Expected #induction-admin-root or #root.');
}

ReactDOM.createRoot(mountEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);