import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { JsonRpcProvider } from 'ethers';
import { demoAccounts } from './demo.mjs';
import { assertFork, localDeployer, FORK_RPC, LOCAL_SEED, writeLocal, warnFork } from './local.mjs';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const rpc = process.env.CASCADE_FORK_RPC ?? FORK_RPC;
const seed = process.env.CASCADE_DEMO_SEED ?? LOCAL_SEED;
const manifest = { mode: 'fork', dryRun: values['dry-run'], rpc, chainId: 5042002,
  usdc: '0x3600000000000000000000000000000000000000', instance: randomUUID(), seed,
  accounts: [localDeployer(null).address, ...demoAccounts(seed).map(a => a.wallet.address)],
  nativeUSDCTransfersSupported: false, funded: false };
warnFork();
if (!values['dry-run']) {
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  try { await assertFork(provider, rpc); } finally { provider.destroy(); }
}
writeLocal(values['dry-run'] ? 'fork.dry-run.json' : 'fork.json', manifest);
console.log('Informational fork manifest written; no storage scan or funding attempted.');
