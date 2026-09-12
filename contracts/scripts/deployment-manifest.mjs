import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './config.mjs';

const config = loadConfig(process.argv[2]);
const run = JSON.parse(readFileSync(`broadcast/Deploy.s.sol/${config.chainId}/run-latest.json`));
const deployment = run.transactions.find(tx => tx.contractName === 'CascadeVault' && tx.transactionType === 'CREATE');
if (!deployment) throw Error('No CascadeVault deployment found');
const receipt = run.receipts.find(receipt => receipt.transactionHash === deployment.hash);
if (!receipt || BigInt(receipt.status) !== 1n) throw Error('No successful deployment receipt');
const manifest = {
  ...config,
  vault: deployment.contractAddress,
  owner: deployment.arguments[1],
  transactionHash: deployment.hash,
  blockNumber: Number(BigInt(receipt.blockNumber)),
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  artifactSha256: createHash('sha256').update(readFileSync('out/CascadeVault.sol/CascadeVault.json')).digest('hex'),
  compiler: '0.8.30', evmVersion: 'prague', optimizerRuns: 200,
};
mkdirSync('deployments', { recursive: true });
writeFileSync(`deployments/${config.chainId}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Deployment: ${config.explorer}/tx/${deployment.hash}`);
console.log(`Vault: ${config.explorer}/address/${manifest.vault}`);
console.log(`Verify: scripts/verify.sh deployments/${config.chainId}.json`);
