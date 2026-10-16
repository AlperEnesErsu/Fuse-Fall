import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  // Architecture boundary: core is pure game rules. It must not know about the
  // physics engine, the browser, or any outer layer (see docs/02-gereksinimler.md §5).
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['matter-js'], message: 'core must use the PhysicsWorld port.' },
            {
              group: ['**/infrastructure/**', '**/presentation/**', '**/app/**', '**/content/**'],
              message: 'core must not depend on outer layers.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
    },
  },
  {
    files: ['src/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['matter-js'], message: 'presentation reads state through core.' },
            { group: ['**/infrastructure/**', '**/app/**'], message: 'Wrong dependency direction.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/presentation/**', '**/app/**'], message: 'Wrong dependency direction.' },
          ],
        },
      ],
    },
  },
);
