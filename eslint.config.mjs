import js from '@eslint/js';

import alignAssignments from './index.cjs';

export default [
	{
		ignores: ['coverage/**', 'node_modules/**']
	},
	js.configs.recommended,
	{
		files: ['**/*.cjs', '**/*.mjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				module: 'readonly',
				require: 'readonly'
			}
		},
		plugins: {
			'align-assignments': alignAssignments
		},
		rules: {
			'align-assignments/align-assignments': 'error',
			indent: ['error', 'tab', { SwitchCase: 1 }],
			semi: ['error', 'always']
		}
	}
];
