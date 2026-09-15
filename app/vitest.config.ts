import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: that file carries the WordPress
// plugin's base path, proxy and output layout, none of which a test run needs.
export default defineConfig({
  test: {
    // jsdom rather than node: api/client.ts reads window.InductionApp at module
    // scope, so anything importing an api module needs a window to exist.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: ['default', 'junit'],
    outputFile: { junit: './test-results/unit.xml' },
  },
});
