import { defineConfig, loadEnv } from 'vite';
import { resolve }               from 'path';
import react                     from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_WP_PROXY_TARGET;

  return {
    plugins: [react()],

    // Base path matches the URL where WordPress will serve these files.
    base: '/wp-content/plugins/staff-portal/assets/app/',

    build: {
      outDir: resolve(__dirname, '../wp-plugin/assets/app'),
      emptyOutDir: true,
      // No sourcemap in the shipped plugin: app.js.map is ~8MB and would
      // publish readable source at a public URL. Flip to true temporarily when
      // a runtime stack needs real file names instead of app.js:40:60630.
      sourcemap: false,
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
