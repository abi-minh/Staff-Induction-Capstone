module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      // Cypress specs run in the test runner, not the browser bundle: they use
      // Mocha and Cypress globals and are not React components.
      files: ['cypress/**/*.ts'],
      env: { browser: true, node: true, mocha: true },
      globals: {
        cy: 'readonly',
        Cypress: 'readonly',
        expect: 'readonly',
        assert: 'readonly',
      },
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      // Vitest specs import their own globals, so only the unused-expression
      // relaxation that assertion libraries need applies here.
      files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      rules: { '@typescript-eslint/no-unused-expressions': 'off' },
    },
  ],
}
