import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if (!existsSync('.world/ports.lock')) execFileSync('port-for', ['--init', process.cwd()], { stdio: 'inherit' });
const port = execFileSync('port-for', ['cascade-dev-web'], { encoding: 'utf8' }).trim();
const child = spawn('pnpm', ['exec', 'vite', ...(process.argv.includes('--preview') ? ['preview'] : []), '--port', port], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
