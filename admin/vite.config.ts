import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';


// Config to build the admin panel app, outputting to the WordPress plugin's assets folder for implementation into plugin.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    cors: true,
  },
  build: {
    outDir: resolve(__dirname, '../wp-plugin/assets/admin'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'admin.js',
        chunkFileNames: 'admin-[name].js',
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'admin.css' : 'assets/[name][extname]',
      },
    },
  },
});
