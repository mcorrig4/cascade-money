import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Contract, HDNodeWallet, JsonRpcProvider, NonceManager, Wallet, keccak256, toUtf8Bytes,
  parseUnits, formatUnits, getAddress } from 'ethers';
import { loadConfig } from './config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const NAMES = ['Apple', 'Foxconn', 'TSMC', 'Corning', 'Glass supplier'];
export function demoAccounts(seed) {
  const root = HDNodeWallet.fromSeed(keccak256(toUtf8Bytes(`Cascade testnet demo:${seed}`)));
  return NAMES.map((name, i) => ({ name, wallet: root.derivePath(`m/44'/60'/0'/0/${i}`) }));
}
export function paymentDates(ids, day) {
  return [...ids].sort((a, b) => {
    const ak = BigInt(a) + (BigInt(a) <= day ? 1n << 255n : 0n);
    const bk = BigInt(b) + (BigInt(b) <= day ? 1n << 255n : 0n);
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
}

async function main() {
  const { values } = parseArgs({ options: {
    amount: { type: 'string', default: '10' }, seed: { type: 'string' },
    config: { type: 'string', default: resolve(ROOT, 'chains/testnet.json') },
    vault: { type: 'string' }, broadcast: { type: 'boolean', default: false },
    'gas-per-account': { type: 'string', default: '0.1' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('node scripts/demo.mjs [--amount 10|100] [--seed text] [--vault address] [--broadcast]');
    console.log('Default is an offline plan. Broadcast requires ARC_DEPLOYER_KEY; actors are testnet only.');
    return;
  }
  const config = loadConfig(values.config);
  if (config.chainId !== 5042002 || config.testnet !== true) throw Error('Generated demo accounts are Arc TESTNET ONLY');
  const amount = parseUnits(values.amount, 6);
  const gasBudget = parseUnits(values['gas-per-account'], 18);
  if (amount <= 0n || gasBudget <= 0n) throw Error('Amount and gas budget must be positive');
  const seed = values.seed ?? process.env.CASCADE_DEMO_SEED ?? randomBytes(32).toString('hex');
  const actors = demoAccounts(seed);
  console.log(`TESTNET demo seed (reproduces actor keys): ${seed}`);
  for (const actor of actors) console.log(`${actor.name}: ${actor.wallet.address}  testnet key: ${actor.wallet.privateKey}`);
  console.log(`Principal: ${formatUnits(amount, 6)} USDC; four invoices: ${formatUnits(amount * 4n, 6)} USDC`);
  console.log('Apple → Foxconn → TSMC → Corning at day+90; Corning extends to day+120 and pays glass supplier.');
  if (!values.broadcast) { console.log('Offline plan only. No RPC calls or transactions.'); return; }

  const key = process.env.ARC_DEPLOYER_KEY;
  if (!key) throw Error('Set ARC_DEPLOYER_KEY in the environment');
  const manifestPath = resolve(ROOT, `deployments/${config.chainId}.json`);
  const address = getAddress(values.vault ?? JSON.parse(readFileSync(manifestPath)).vault);
  const provider = new JsonRpcProvider(config.rpcUrl);
  try {
    const chainId = BigInt(await provider.send('eth_chainId', []));
    if (chainId !== BigInt(config.chainId)) throw Error('RPC chain mismatch');
    if (await provider.getCode(config.usdc) === '0x' || await provider.getCode(address) === '0x') throw Error('Contract code missing');
    const deployer = new NonceManager(new Wallet(key, provider));
    const deployerAddress = await deployer.getAddress();
    const artifact = JSON.parse(readFileSync(resolve(ROOT, 'out/CascadeVault.sol/CascadeVault.json')));
    const vault = new Contract(address, artifact.abi, deployer);
    const token = new Contract(config.usdc, [
      'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)',
      'function transfer(address,uint256) returns (bool)', 'function approve(address,uint256) returns (bool)',
    ], deployer);
    if (Number(await token.decimals()) !== 6) throw Error('USDC must have six ERC-20 decimals');
    if (getAddress(await vault.usdc()) !== getAddress(config.usdc)) throw Error('Vault USDC mismatch');
    if (getAddress(await vault.owner()) !== deployerAddress) throw Error('Deployer must be the checkpoint owner for this demo');
    // One underlying asset: native gas + principal + deployer transaction headroom, in native precision.
    const required = amount * 10n ** 12n + gasBudget * 5n + parseUnits('0.2', 18);
    if (await provider.getBalance(deployerAddress) < required) {
      throw Error(`Deployer needs at least ${formatUnits(required, 18)} USDC for this run`);
    }
    const transactions = [];
    const runId = `${config.chainId}-${Date.now()}`;
    mkdirSync(resolve(ROOT, 'deployments'), { recursive: true });
    const save = () => writeFileSync(resolve(ROOT, `deployments/demo-${runId}.json`), JSON.stringify({
      chainId: config.chainId, vault: address, amount: formatUnits(amount, 6),
      actors: actors.map(a => ({ name: a.name, address: a.wallet.address })), transactions,
    }, null, 2) + '\n'); // Public data only; seed and keys are NEVER saved.
    async function fees() {
      const data = await provider.getFeeData();
      const offered = data.maxFeePerGas ?? data.gasPrice ?? 0n;
      return { maxFeePerGas: offered < 20_000_000_000n ? 20_000_000_000n : offered * 2n,
        maxPriorityFeePerGas: 1_000_000_000n };
    }
    async function send(label, submit) {
      const tx = await submit(await fees());
      const link = `${config.explorer}/tx/${tx.hash}`;
      console.log(`${label}: ${link}`);
      transactions.push({ label, hash: tx.hash, explorer: link, status: 'pending' }); save();
      const receipt = await tx.wait(1, 120_000);
      if (!receipt || receipt.status !== 1) throw Error(`${label} failed or timed out: ${link}`);
      Object.assign(transactions.at(-1), { status: 'success', blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString() }); save();
      return receipt;
    }
    for (const actor of actors) {
      actor.signer = new NonceManager(actor.wallet.connect(provider));
      await send(`Gas funding ${actor.name}`, f => deployer.sendTransaction({ to: actor.wallet.address, value: gasBudget, ...f }));
    }
    await send('Principal funding Apple', f => token.transfer(actors[0].wallet.address, amount, f));
    await send('Apple approves vault', f => token.connect(actors[0].signer).approve(address, amount, f));
    // Catch up elapsed days with explicit zero demo income. Never publish a future checkpoint.
    async function catchUp() {
      const current = await vault.today(); const last = await vault.lastCheckpoint();
      if (current - last > 32n) throw Error('Checkpoint backlog exceeds 32 days; catch up separately before demo');
      for (let day = last + 1n; day <= current; day++) {
        await send(`Zero-income checkpoint ${day}`, f => vault.checkpoint(0, f));
      }
    }
    await catchUp();
    const today = await vault.today(); const maturity = today + 90n; const extended = today + 120n;
    const invoices = [];
    for (let i = 0; i < 4; i++) {
      const due = i === 3 ? extended : maturity;
      const receipt = await send(`${actors[i+1].name} registers invoice`, f =>
        vault.connect(actors[i+1].signer)['registerInvoice(address,uint256,uint32,uint32)'](actors[i].wallet.address, amount, due, due, f));
      const event = receipt.logs.filter(log => log.address.toLowerCase() === address.toLowerCase())
        .map(log => { try { return vault.interface.parseLog(log); } catch { return null; } })
        .find(log => log?.name === 'InvoiceRegistered');
      if (!event) throw Error('Missing InvoiceRegistered event');
      invoices.push(event.args.invoiceId);
    }
    await catchUp();
    await send('Apple issues to Foxconn', f => vault.connect(actors[0].signer).issue(invoices[0], amount, f));
    for (let i = 1; i < 3; i++) {
      await send(`${actors[i].name} pays ${actors[i+1].name}`, f =>
        vault.connect(actors[i].signer)['pay(bytes32,uint256,uint256[],uint256)'](invoices[i], amount, [maturity], amount, f));
    }
    await catchUp();
    await send('Corning extends +90 to +120', f => vault.connect(actors[3].signer).extend(amount, maturity, extended, f));
    await send('Corning pays glass supplier', f =>
      vault.connect(actors[3].signer)['pay(bytes32,uint256,uint256[],uint256)'](invoices[3], amount, [extended], amount, f));
    for (const id of invoices) if ((await vault.invoices(id)).outstanding !== 0n) throw Error('Invoice did not settle');
    if (await vault.balanceOf(actors[4].wallet.address, extended) !== amount) throw Error('Final principal mismatch');
    const sheet = await vault.balanceSheet();
    if (sheet.deficit !== 0n) throw Error('Backing invariant failed');
    console.log(`Settled ${formatUnits(amount*4n,6)} USDC using ${formatUnits(amount,6)} USDC principal.`);
    console.log(`Vault: ${config.explorer}/address/${address}`);
    console.log('Yield intervals are recorded. Day+90/day+120 claim and maturity require real UTC time.');
  } finally { provider.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.shortMessage ?? error.message); process.exitCode = 1; });
}
