import { defineConfig } from 'vite';
import type { ConfigEnv, UserConfig } from 'vite';
import baseConfig from './vite.config';

// Build profile for the Cypress lifecycle suite only.
//
// The plugin build sets base to /wp-content/plugins/staff-portal/assets/app/,
// because that is where WordPress serves it from. `vite preview` honours that
// base, so serving the plugin build gives a 404 at the site root and every
// cy.visit('/#/...') fails — which is exactly what happened the first time the
// lifecycle specs ran.
//
// This overrides two things and nothing else: a root base, and its own output
// directory. The separate outDir is not cosmetic — the default build writes
// into wp-plugin/assets/app, and a root-based bundle landing there would ship
// in the plugin zip and 404 on every asset in production.
//
// Expressed as a config file rather than CLI flags on purpose: `--base=/` is
// rewritten to a Windows path by Git Bash's MSYS path conversion, so the same
// command behaves differently depending on which shell a developer happens to
// use. There is nothing to mangle here.
export default defineConfig(async (env: ConfigEnv): Promise<UserConfig> => {
  const resolveBase = baseConfig as unknown as (e: ConfigEnv) => UserConfig | Promise<UserConfig>;
  const cfg = await resolveBase(env);

  return {
    ...cfg,
    base: '/',
    build: {
      ...cfg.build,
      outDir: 'dist-e2e',
      emptyOutDir: true,
      sourcemap: false,
    },
  };
});
