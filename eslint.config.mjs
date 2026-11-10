import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	{ ignores: ['node_modules/**', 'main.js', '*.mjs', 'test/**', 'scripts/**'] },
	...obsidianmd.configs.recommended,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
				sourceType: 'module',
			},
		},
	},
]);
