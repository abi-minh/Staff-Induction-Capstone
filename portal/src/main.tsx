
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// WordPress embeds the portal by placing <div id="induction-portal-root"></div>
// on the page via the shortcode. Fall back to #root for local dev.
const mountEl =
  document.getElementById('induction-portal-root') ??
  document.getElementById('root');

if (!mountEl) {
  throw new Error('Mount element not found. Expected #induction-portal-root or #root.');
}

ReactDOM.createRoot(mountEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
