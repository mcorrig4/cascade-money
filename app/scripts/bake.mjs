import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const venv = fileURLToPath(new URL('../../.venv/bin/python3', import.meta.url));
const result = spawnSync(existsSync(venv) ? venv : 'python3', ['-m', 'sim', 'run', '--world', 'apple', '--days', '365', '--seed', '1', '--out', 'events.ndjson'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await import('./prepare-data.mjs');
