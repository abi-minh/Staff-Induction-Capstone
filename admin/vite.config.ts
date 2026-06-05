import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The admin app is a standalone SPA — it is NOT embedded in WordPress.
// It can be deployed to any static host (Vercel, Netlify, etc.) or a
// subdirectory/subdomain of the existing WP server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    cors: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':   ['@tanstack/react-query'],
          'vendor-form':    ['react-hook-form', 'zod', '@hookform/resolvers'],
          'vendor-editor':  ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-link', '@tiptap/extension-image'],
          'vendor-charts':  ['recharts'],
        },
      },
    },
  },
});
