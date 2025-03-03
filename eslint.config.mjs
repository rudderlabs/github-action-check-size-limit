import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jestPlugin from 'eslint-plugin-jest';
import githubPlugin from 'eslint-plugin-github';
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments';
import filenamesPlugin from 'eslint-plugin-filenames';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: [
      'dist/**/*',
      'lib/**/*',
      'node_modules/**/*',
      '**/*.spec.*'
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...jestPlugin.environments.globals.globals,
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jest: jestPlugin,
      github: githubPlugin,
      'eslint-comments': eslintCommentsPlugin,
      filenames: filenamesPlugin,
    },
    rules: {
      'no-console': 'off',
      'filenames/match-regex': 'off',
      'eslint-comments/no-duplicate-disable': 'error',
      'eslint-comments/no-unlimited-disable': 'error',
      'eslint-comments/no-unused-disable': 'error',
      'eslint-comments/no-unused-enable': 'error',
      'github/array-foreach': 'error',
      'github/no-then': 'error',
      'import/no-commonjs': 'off',
      'import/no-namespace': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
); 
