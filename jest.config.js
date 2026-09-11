export default {
    testEnvironment: 'node',
    testMatch: ['**/src/__tests__/**/*.test.js'],
    moduleFileExtensions: ['js'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/src/__tests__/',
        '/coverage/',
        '/middleware/',
        '/services/error/',
        '/services/di/',
        '/services/config/',
        'server.js',
    ],
    verbose: true,
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1.js'
    },
    setupFiles: ['<rootDir>/src/__tests__/setup.js']
}; 