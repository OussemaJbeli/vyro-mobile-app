/** @type {import('jest').Config} */
module.exports = {
  // Screen tests render full flows and get slow when every suite runs in parallel.
  testTimeout: 30000,
  preset: 'jest-expo',
  // Order matters: the specific @/assets alias must win over the general @/* one.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/docs/', '/e2e/'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@noble/.*))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/app/**',
    '!src/db/testing/**',
    '!src/domain/**/testing/**',
  ],
  // Domain coverage gate (roadmap step 16): pure logic must stay thoroughly tested.
  coverageThreshold: { './src/domain/': { lines: 90 } },
};
