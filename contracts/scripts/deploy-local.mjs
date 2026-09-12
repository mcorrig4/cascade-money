import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ContractFactory, JsonRpcProvider } from 'ethers';
import { FORK_RPC, assertFork, signingWallet } from './local.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const rpc = process.env.CASCADE_FORK_RPC ?? FORK_RPC;
const provider = new JsonRpcProvider(rpc);
try {
  await assertFork(provider,rpc);
  const owner = signingWallet(provider,false);
  const artifact = JSON.parse(readFileSync(resolve(root,'out/CascadeVault.sol/CascadeVault.json')));
  const usdc = '0x3600000000000000000000000000000000000000';
  const vault = await new ContractFactory(artifact.abi,artifact.bytecode.object,owner).deploy(usdc,await owner.getAddress());
  await vault.waitForDeployment();
  mkdirSync(resolve(root,'.local'),{recursive:true});
  writeFileSync(resolve(root,'.local/default-vault.json'),JSON.stringify({vault:await vault.getAddress(),usdc,rpc},null,2)+'\n');
  console.log('Local USDC vault: ' + await vault.getAddress());
} finally { provider.destroy(); }
