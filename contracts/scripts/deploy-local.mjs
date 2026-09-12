import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ContractFactory, JsonRpcProvider, NonceManager, parseUnits, toBeHex, getCreateAddress } from 'ethers';
import { ROOT, FORK_RPC, LOCAL_SEED, assertLocal, assertLoopback, localDeployer, writeLocal } from './local.mjs';
import { demoAccounts } from './demo.mjs';

const { values } = parseArgs({ options: {
  rpc: { type: 'string' }, seed: { type: 'string' },
  funding: { type: 'string', default: '1000000' }, 'dry-run': { type: 'boolean', default: false },
} });
const rpc = values.rpc ?? process.env.CASCADE_LOCAL_RPC ?? FORK_RPC;
assertLoopback(rpc);
const seed = values.seed ?? process.env.CASCADE_DEMO_SEED ?? LOCAL_SEED;
const funding = parseUnits(values.funding, 6);
if (funding <= 0n) throw Error('Funding must be positive');
const deployer = localDeployer(null);
const actors = demoAccounts(seed).map(a => ({ name: a.name, address: a.wallet.address }));
const accounts = [deployer.address, ...actors.map(a => a.address)];
const manifest = { mode: 'local', dryRun: values['dry-run'], chainId: 31337, rpc, seed,
  instance: randomUUID(), deployer: deployer.address, actors, accounts, funding: funding.toString() };
if (values['dry-run']) {
  // Illustrative nonce-zero addresses only; never overwrite an executable manifest.
  manifest.usdc = getCreateAddress({ from: deployer.address, nonce: 0 });
  manifest.vault = getCreateAddress({ from: deployer.address, nonce: 7 });
  writeLocal('local.dry-run.json', manifest);
  console.log('DRY RUN: plain Anvil 31337; deploy MockUSDC, mint to six accounts, deploy CascadeVault.');
  console.log(JSON.stringify(manifest));
} else {
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  try {
    await assertLocal(provider, rpc);
    for (const account of accounts) await provider.send('anvil_setBalance', [account, toBeHex(parseUnits('1000', 18))]);
    const owner = new NonceManager(deployer.connect(provider));
    async function deploy(name, args) {
      const a = JSON.parse(readFileSync(resolve(ROOT, `out/${name}.sol/${name}.json`)));
      const c = await new ContractFactory(a.abi, a.bytecode.object, owner).deploy(...args);
      await c.waitForDeployment();
      return c;
    }
    const token = await deploy('MockUSDC', []);
    for (const account of accounts) {
      await (await token.mint(account, funding)).wait();
      if (await token.balanceOf(account) !== funding) throw Error('Mock USDC mint verification failed');
    }
    const vault = await deploy('CascadeVault', [await token.getAddress(), deployer.address]);
    Object.assign(manifest, { usdc: await token.getAddress(), vault: await vault.getAddress() });
    writeLocal('local.json', manifest);
    console.log(JSON.stringify(manifest, null, 2));
  } finally { provider.destroy(); }
}
