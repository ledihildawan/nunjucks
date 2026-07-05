import eslint from '@eslint/js';
import globals from 'globals';
import pluginImport from 'eslint-plugin-import';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  eslint.configs.recommended,
  {
    plugins: {
      import: pluginImport,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.browser,
      },
    },
    rules: {
      'func-names': 'off',
      'global-require': 'off',
      'spaced-comment': [
        'error',
        'always',
        {
          exceptions: ['*', ','],
        },
      ],
      'one-var': 'off',
      'one-var-declaration-per-line': 'off',
      'no-restricted-syntax': 'off',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-shadow': 'error',
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'none',
        },
      ],
      'no-eval': 'error',
      'vars-on-top': 'error',
      'no-array-constructor': 'error',
      'no-new-wrappers': 'error',
      'consistent-return': 'error',
    },
  },
]);
