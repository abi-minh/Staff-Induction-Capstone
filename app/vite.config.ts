import { defineConfig, loadEnv } from 'vite';
import { resolve }               from 'path';
import react                     from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_WP_PROXY_TARGET;

  return {
    plugins: [react()],

    // Base path matches the URL where WordPress will serve these files.
    base: '/wp-content/plugins/induction-platform/assets/app/',

    build: {
      outDir: resolve(__dirname, '../wp-plugin/assets/app'),
      emptyOutDir: true,
      // Diagnostic: lets a runtime error in the deployed bundle report a real
      // file and line instead of 'app.js:341'. Costs a ~5MB app.js.map in the
      // plugin assets; safe to turn off once the dnd-kit crash is pinned down.
      sourcemap: true,
      rollupOptions: {
        output: {
          entryFileNames: 'app.js',
          chunkFileNames: 'app-[name].js',
          assetFileNames: (info) =>
            info.name?.endsWith('.css') ? 'app.css' : 'assets/[name][extname]',
        },
      },
    },

    server: {
      port: 5175,
      cors: true,
      proxy: proxyTarget ? {
        '/wp-proxy': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wp-proxy/, ''),
          headers: { origin: proxyTarget },
        },
      } : undefined,
    },
  };
});
