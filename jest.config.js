/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/src', '<rootDir>/test'],
	testMatch: ['**/*.test.ts'],
	moduleNameMapper: {
		'^api/types$': '<rootDir>/api/types.ts',
		'^api$': '<rootDir>/test/mocks/joplinApi.ts',
	},
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'json-summary'],
	coverageThreshold: { global: { statements: 100, branches: 95, functions: 100, lines: 100 } },
};
