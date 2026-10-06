module.exports = {
  preset: 'ts-jest',
  transform: { '^.+\\.tsx?$': 'ts-jest', '^.+\\.js$': '<rootDir>/jest-esm-transform.cjs' },
  transformIgnorePatterns: [
    'node_modules/(?!sanitize-html/node_modules/|htmlparser2/|domhandler/|domutils/|domelementtype/|entities/|dom-serializer/)',
  ],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@api/(.*)\\.js$': '<rootDir>/src/$1',
    '^@commerceos/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^\\./(enums|dto|orders)\\.js$': '<rootDir>/../../packages/shared/src/$1.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: { global: { lines: 70 } },
};
