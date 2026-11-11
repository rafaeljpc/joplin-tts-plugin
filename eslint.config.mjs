import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Forbids a layer from importing the given inner/outer layers and the Joplin API. */
function layerRule(files, forbidden) {
	return [
		{
			files: [files],
			rules: {
				'no-restricted-imports': [
					'error',
					{
						patterns: [
							{
								group: [
									...forbidden.map((layer) => `**/${layer}`),
									...forbidden.map((layer) => `**/${layer}/**`),
									'api',
									'api/*',
								],
								message: `This layer must not depend on: ${forbidden.join(', ')} or the Joplin API.`,
							},
						],
					},
				],
			},
		},
	];
}

export default tseslint.config(
	{
		ignores: [
			'api/**',
			'dist/**',
			'publish/**',
			'coverage/**',
			'.cache/**',
			'test/integration/**',
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
	// Dependency rule: domain <- application <- adapters <- webview <- (Joplin entry points).
	// A layer may only import from the layers on its left.
	...layerRule('src/domain/**', ['application', 'adapters', 'webview', 'compose', 'plugin']),
	...layerRule('src/application/**', ['adapters', 'webview', 'compose', 'plugin']),
	...layerRule('src/adapters/**', ['webview', 'compose', 'plugin']),
	...layerRule('src/webview/**', ['compose', 'plugin']),
	{
		files: ['**/*.test.ts'],
		rules: { '@typescript-eslint/no-require-imports': 'off' },
	},
);
