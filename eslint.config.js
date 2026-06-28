import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Herken de codebase-conventie: `_` = bewust genegeerd (args + catch-binding).
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Lege catch-blokken zijn een bewuste "negeer de fout"-keuze.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Advies-/HMR-regels (geen correctheidsfouten) → waarschuwing i.p.v. error.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Node-context bestanden (configs, scripts, e2e-tests) — Node-globals i.p.v. browser,
    // zodat process/__dirname e.d. bekend zijn.
    files: ['**/*.config.{js,mjs}', 'stress-test.mjs', 'e2e/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
