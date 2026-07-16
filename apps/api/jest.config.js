/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@orkalis/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@orkalis/shared/(.*)$': '<rootDir>/../../../packages/shared/src/$1',
  },
};
