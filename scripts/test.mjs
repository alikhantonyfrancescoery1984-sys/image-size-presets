import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

mkdirSync('test/.build', { recursive: true });

await esbuild.build({
	entryPoints: ['test/resolve.test.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node20',
	outfile: 'test/.build/resolve.test.mjs',
	logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--test', 'test/.build/resolve.test.mjs'], { stdio: 'inherit' });
rmSync('test/.build', { recursive: true, force: true });
process.exit(result.status ?? 1);
