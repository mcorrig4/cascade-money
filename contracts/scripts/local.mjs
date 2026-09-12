import { HDNodeWallet, keccak256, toUtf8Bytes, Wallet } from 'ethers';
export const FORK_RPC = 'http://127.0.0.1:8545';
export const LOCAL_SEED = 'cascade-local-fork';
export function localDeployer(provider) {
  // Public deterministic seed for an isolated Anvil instance; never a live signing identity.
  return HDNodeWallet.fromSeed(keccak256(toUtf8Bytes('Cascade isolated fork deployer'))).connect(provider);
}
export function signingWallet(provider, live) {
  if (!live) return process.env.ARC_DEPLOYER_KEY ? new Wallet(process.env.ARC_DEPLOYER_KEY, provider) : localDeployer(provider);
  if (!process.env.ARC_DEPLOYER_KEY) throw Error('Set ARC_DEPLOYER_KEY for explicit --live execution');
  return new Wallet(process.env.ARC_DEPLOYER_KEY, provider);
}
export async function assertFork(provider, rpc) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(rpc).hostname)) throw Error('Without --live, RPC must be loopback Anvil');
  const info = await provider.send('anvil_nodeInfo', []);
  if (!info.forkConfig?.forkUrl) throw Error('Anvil must fork Arc testnet; a blank local chain is not the standard target');
  if (BigInt(await provider.send('eth_chainId', [])) !== 5042002n) throw Error('Fork chain must be 5042002');
  return info;
}
