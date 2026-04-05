/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'mjs'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/node_modules/@actions/core/lib/core.js',
    '^@actions/exec$': '<rootDir>/node_modules/@actions/exec/lib/exec.js',
    '^@actions/glob$': '<rootDir>/node_modules/@actions/glob/lib/glob.js',
    '^@actions/io$': '<rootDir>/node_modules/@actions/io/lib/io.js',
    '^@actions/io/lib/io-util$':
      '<rootDir>/node_modules/@actions/io/lib/io-util.js',
    '^@actions/http-client$': '<rootDir>/node_modules/@actions/http-client/lib/index.js',
    '^@actions/http-client/lib/auth$':
      '<rootDir>/node_modules/@actions/http-client/lib/auth.js',
    '^@actions/cache/lib/internal/(.*)$':
      '<rootDir>/node_modules/@actions/cache/lib/internal/$1',
  },
  // @actions/* ship ESM .js; transform them so Jest can load utils.ts in tests.
  transform: {
    '^.+\\.jsx?$': [
      'babel-jest',
      { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!@actions/)'],
};
