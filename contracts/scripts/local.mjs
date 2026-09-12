import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { HDNodeWallet, keccak256, toUtf8Bytes, Wallet } from 'ethers';
export const FORK_RPC = 'http://127.0.0.1:8545';
export const LOCAL_SEED = 'cascade-local-fork';
export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export function localDeployer(provider) {
  return HDNodeWallet.fromSeed(keccak256(toUtf8Bytes('Cascade isolated fork deployer'))).connect(provider);
}
export function signingWallet(provider, live) {
  if (!live) return localDeployer(provider);
  if (!process.env.ARC_DEPLOYER_KEY) throw Error('Set ARC_DEPLOYER_KEY for explicit --live execution');
  return new Wallet(process.env.ARC_DEPLOYER_KEY, provider);
}
export function assertLoopback(rpc) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(rpc).hostname)) throw Error('Without --live, RPC must be loopback Anvil');
}
export async function assertFork(provider, rpc) {
  assertLoopback(rpc);
  const info = await provider.send('anvil_nodeInfo', []);
  if (!info.forkConfig?.forkUrl) throw Error('--fork requires an Arc fork');
  if (BigInt(await provider.send('eth_chainId', [])) !== 5042002n) throw Error('Fork chain must be 5042002');
  return info;
}
export async function assertLocal(provider, rpc) {
  assertLoopback(rpc);
  const info = await provider.send('anvil_nodeInfo', []);
  if (info.forkConfig?.forkUrl) throw Error('Default target must be plain Anvil; use --fork for informational Arc mode');
  if (BigInt(await provider.send('eth_chainId', [])) !== 31337n) throw Error('Local chain must be 31337');
}
export function writeLocal(name, value) {
  mkdirSync(resolve(ROOT, '.local'), { recursive: true });
  writeFileSync(resolve(ROOT, '.local', name), JSON.stringify(value, null, 2) + '\n');
}
export function localTarget(values) {
  if (values.live && values.fork) throw Error('--live and --fork are mutually exclusive');
  const mode = values.fork ? 'fork' : 'local';
  const name = values['dry-run'] ? `${mode}.dry-run.json` : `${mode}.json`;
  const manifest = JSON.parse(readFileSync(resolve(ROOT, '.local', name)));
  if (manifest.dryRun && !values['dry-run']) throw Error('Dry-run manifest cannot be used for execution');
  if (manifest.chainId !== (values.fork ? 5042002 : 31337)) throw Error('Manifest chain mismatch');
  const rpc = values.rpc ?? (values.fork ? process.env.CASCADE_FORK_RPC : process.env.CASCADE_LOCAL_RPC) ?? manifest.rpc;
  assertLoopback(rpc);
  return { ...manifest, rpc, mode };
}
export function warnFork() {
  console.warn('INFORMATIONAL ARC FORK: native USDC has no conventional balance slot and its transfer path fails on plain Anvil. Use local mock USDC for the story.');
}
