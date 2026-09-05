import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = realpathSync.native(resolve(fileURLToPath(new URL('..', import.meta.url))));
const vitestCli = resolve(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs');

process.chdir(repositoryRoot);

const result = spawnSync(process.execPath, [vitestCli, 'run', ...process.argv.slice(2)], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});

if (result.error) {
  console.error(`Could not start Vitest: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
