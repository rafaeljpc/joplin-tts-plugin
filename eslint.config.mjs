import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'api/**',
			'dist/**',
			'publish/**',
			'coverage/**',
			'webpack.config.js',
			'jest.config.js',
			'.github/scripts/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
			eqeqeq: 'error',
		},
	},
	{
		files: ['**/*.test.ts'],
		rules: { '@typescript-eslint/no-require-imports': 'off' },
	},
);
