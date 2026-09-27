// @ts-check
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

/**
 * Architecture rules (docs/roadmap/00-overview.md §3, "Rule of layers").
 * `no-restricted-imports` does not merge across config blocks, so every block
 * gets the shared AI-provider restriction plus its own layer restrictions.
 */
const AI_SDKS = {
  group: ['openai', 'openai/*', '@anthropic-ai/*', '@google/generative-ai'],
  message: 'AI provider SDKs may only be imported inside src/services/ai (AD-18).',
};

/** @param {Array<{ group: string[]; message: string }>} patterns */
const restrict = (...patterns) => ['error', { patterns: [AI_SDKS, ...patterns] }];

const layer = {
  db: {
    group: ['@/db', '@/db/*', '**/db/*'],
    message: 'UI must read data through hooks, never @/db directly (FS §49).',
  },
  ui: {
    group: [
      '@/components',
      '@/components/*',
      '@/store',
      '@/store/*',
      '@/hooks',
      '@/hooks/*',
      '@/app/*',
    ],
    message: 'This layer must not depend on UI, stores or hooks.',
  },
  runtime: {
    group: ['react', 'react-*', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*'],
    message: 'src/domain is pure TypeScript: no React, React Native or Expo imports (AD-11).',
  },
  services: {
    group: ['@/services', '@/services/*'],
    message: 'src/domain must not depend on services.',
  },
};

// Hex colours (#fff, #01070C, #7EFF00AA) and rgb()/hsl() literals are only allowed in src/theme.
const RAW_COLOR = [
  'error',
  {
    selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message: 'Use theme tokens instead of raw colours (FS §46). Raw colours belong in src/theme.',
  },
  {
    selector: 'Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]',
    message: 'Use theme tokens instead of raw colours (FS §46). Raw colours belong in src/theme.',
  },
];

// SQL values must be bound parameters: no interpolated template literals in run/all/get (step 07).
const SQL_INTERPOLATION = {
  selector:
    'CallExpression[callee.property.name=/^(run|all|get)$/] > TemplateLiteral.arguments[expressions.length>0]',
  message: 'Bind SQL values as parameters (?) instead of interpolating them.',
};

module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    'coverage/*',
    'android/*',
    'ios/*',
    '.expo/*',
    'docs/*',
    'expo-env.d.ts',
  ]),
  expoConfig,
  prettierRecommended,
  { rules: { 'no-restricted-imports': restrict() } },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**'],
    rules: { 'no-restricted-syntax': RAW_COLOR },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(layer.db) },
  },
  {
    files: ['src/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(layer.ui),
      // Repeats the raw-colour selectors: no-restricted-syntax does not merge across blocks.
      'no-restricted-syntax': [...RAW_COLOR, SQL_INTERPOLATION],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(layer.runtime, layer.db, layer.ui, layer.services) },
  },
  { files: ['src/services/ai/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': 'off' } },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly' },
    },
  },
]);
