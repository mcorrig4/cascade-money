import { spawn } from 'node:child_process';
const port = process.env.CASCADE_DEV_PORT?.trim() || '5173';
const child = spawn('pnpm', ['exec', 'vite', ...(process.argv.includes('--preview') ? ['preview'] : []), '--port', port], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
