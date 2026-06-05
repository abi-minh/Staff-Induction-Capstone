import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Output goes into the WordPress plugin's assets folder so the plugin
    // can enqueue the built files directly with wp_enqueue_script().
    outDir: resolve(__dirname, '../wp-plugin/assets'),
    emptyOutDir: true,

    rollupOptions: {
      output: {
        // Predictable filenames so the PHP plugin can hardcode the paths.
        entryFileNames: 'portal.js',
        chunkFileNames: 'portal-[name].js',
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'portal.css' : 'assets/[name][extname]',
      },
    },
  },

  // Allow the dev server to be accessed from the WP dev environment.
  server: {
    cors: true,
  },
});
