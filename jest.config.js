// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@config$': '<rootDir>/src/config',
    '^@functions/(.*)$': '<rootDir>/src/functions/$1',
    '^@functions$': '<rootDir>/src/functions',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@lib$': '<rootDir>/src/lib',
    '^@queue/(.*)$': '<rootDir>/src/queue/$1',
    '^@queue$': '<rootDir>/src/queue',
    '^@service/(.*)$': '<rootDir>/src/service/$1',
    '^@service$': '<rootDir>/src/service',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
    '^@tests$': '<rootDir>/src/tests',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@utils$': '<rootDir>/src/utils',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};
