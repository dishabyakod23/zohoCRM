const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/out/'],
  collectCoverageFrom: [
    'src/lib/**/*.js',
    'src/hooks/**/*.js',
    'src/components/**/*.js',
    '!src/**/*.stories.js',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
};

module.exports = createJestConfig(customJestConfig);
