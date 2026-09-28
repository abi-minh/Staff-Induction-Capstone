import { Box } from '@mui/material';
import logoUrl from '../assets/2-bent-rods-logo.png';

// Imported rather than referenced by path so Vite fingerprints it and rewrites
// the URL against the configured base. That matters here because the same
// source builds twice: the plugin bundle serves from
// /wp-content/plugins/staff-portal/assets/app/, while the Cypress e2e bundle
// serves from the root. A hard-coded path would be right in exactly one of them.

interface Props {
  /** Rendered height in px; the logo is square, so width follows. */
  size?: number;
}

/**
 * The client's mark, standing in for the wordmark it replaced — so it carries
 * the business name as its alt text rather than being decoration. Both portal
 * sidebars use this, which is the point: one place to change when the client
 * sends a new file.
 */
export default function BrandLogo({ size = 96 }: Props) {
  return (
    <Box
      component="img"
      src={logoUrl}
      alt="2 Bent Rods"
      sx={{ width: size, height: size, display: 'block', objectFit: 'contain' }}
    />
  );
}
