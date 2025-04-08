export default {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    moduleFileExtensions: ['js'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(assemblyai)/)'
    ],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/',
        '/coverage/'
    ],
    verbose: true,
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1.js'
    },
    setupFiles: ['<rootDir>/__tests__/setup.js']
}; 