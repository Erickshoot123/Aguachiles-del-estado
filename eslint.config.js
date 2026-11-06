import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**', 'referencia/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packaging/**/*.mjs'],
    languageOptions: { globals: {
      process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', AbortSignal: 'readonly',
      setTimeout: 'readonly', clearTimeout: 'readonly', Buffer: 'readonly',
    } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
