import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Contract, HDNodeWallet, JsonRpcProvider, keccak256, toUtf8Bytes,
  parseUnits, formatUnits, getAddress } from 'ethers';
import { loadConfig } from './config.mjs';
import { openRun, journaledSend } from './journal.mjs';
import { LOCAL_SEED, assertFork, assertLocal, signingWallet, localTarget, writeLocal, warnFork } from './local.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const NAMES = ['Apple', 'Samsung Display', 'Corning', 'Silica supplier', 'Freight carrier'];
export const GOODS = ['folding OLED panels', 'ultra-thin cover glass', 'silica feedstock', 'freight'];
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

export function checkCheckpoint(current, last, allowZero) {
  if (last > current || current - last > 32n) throw Error('Invalid checkpoint or backlog exceeds 32 days');
  if (last < current && !allowZero) throw Error('Stale vault: explicitly pass --zero-income-catch-up to assign zero income');
}

async function main() {
  const { values } = parseArgs({ options: {
    amount: { type: 'string', default: '10' }, seed: { type: 'string' },
    config: { type: 'string', default: resolve(ROOT, 'chains/testnet.json') },
    fork: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false },
    live: { type: 'boolean', default: false }, rpc: { type: 'string' },
    vault: { type: 'string' }, broadcast: { type: 'boolean', default: false },
    'zero-income-catch-up': { type: 'boolean', default: false },
    'state-dir': { type: 'string' },
    'gas-per-account': { type: 'string', default: '0.1' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('node scripts/demo.mjs [--amount 10|100] [--seed text] [--vault address] [--broadcast] [--live|--fork] [--dry-run] [--rpc URL] [--zero-income-catch-up] [--state-dir path]');
    console.log('Default is an offline plan targeting .local/local.json (plain Anvil + MockUSDC). --broadcast executes locally; live requires --live and ARC_DEPLOYER_KEY.');
    return;
  }
  if (values.live && values.fork) throw Error('--live and --fork are mutually exclusive');
  const target = values.live ? null : localTarget(values);
  if (values.fork) warnFork();
  const mode = values.live ? 'live' : target.mode;
  const config = values.live ? loadConfig(values.config) : { ...target, testnet: true };
  if (values.live && (config.chainId !== 5042002 || config.testnet !== true)) throw Error('Generated demo accounts are Arc TESTNET ONLY');
  const amount = parseUnits(values.amount, 6);
  const gasBudget = parseUnits(values['gas-per-account'], 18);
  if (amount <= 0n || gasBudget <= 0n) throw Error('Amount and gas budget must be positive');
  if (values.live && values.broadcast && !values.seed && !process.env.CASCADE_DEMO_SEED) throw Error('Broadcast requires --seed or CASCADE_DEMO_SEED so this run can be resumed');
  const seed = values.seed ?? process.env.CASCADE_DEMO_SEED ?? (values.live ? randomBytes(32).toString('hex') : target.seed ?? LOCAL_SEED);
  const actors = demoAccounts(seed);
  console.log(`TESTNET demo seed (reproduces actor keys): ${seed}`);
  for (const actor of actors) console.log(`${actor.name}: ${actor.wallet.address}  testnet key: ${actor.wallet.privateKey}`);
  console.log(`Principal: ${formatUnits(amount, 6)} USDC; four invoices: ${formatUnits(amount * 4n, 6)} USDC`);
  console.log('Apple → Samsung Display (folding OLED panels) → Corning (ultra-thin cover glass) → Silica supplier; silica extends and pays Freight carrier at day+120.');
  if (values['dry-run']) {
    writeLocal('demo.dry-run.json', { dryRun: true, mode, chainId: config.chainId, rpc: values.rpc ?? target?.rpc ?? config.rpcUrl,
      vault: values.vault ?? target?.vault ?? null, usdc: config.usdc, seed, amount: amount.toString(),
      actors: actors.map(a => ({ name: a.name, address: a.wallet.address })) });
    console.log('DRY RUN: .local/demo.dry-run.json; no RPC calls or transactions.'); return;
  }
  if (!values.broadcast) { console.log('Offline plan only. No RPC calls or transactions.'); return; }

  const manifest = target ?? JSON.parse(readFileSync(resolve(ROOT, `deployments/${config.chainId}.json`)));
  if (!values.vault && !manifest.vault) throw Error('No fork vault is configured; Arc native-USDC funding/transfers are unsupported on plain Anvil');
  const address = getAddress(values.vault ?? manifest.vault);
  const rpc = values.rpc ?? (values.live ? config.rpcUrl : target.rpc);
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  try {
    if (!values.live) await (values.fork ? assertFork : assertLocal)(provider, rpc);
    const chainId = BigInt(await provider.send('eth_chainId', []));
    if (chainId !== BigInt(config.chainId)) throw Error('RPC chain mismatch');
    if (await provider.getCode(config.usdc) === '0x' || await provider.getCode(address) === '0x') throw Error('Contract code missing');
    const deployer = signingWallet(provider, values.live);
    const deployerAddress = await deployer.getAddress();
    if (actors.some(a => a.wallet.address === deployerAddress)) throw Error("Deployer must be distinct from demo actors");
    const artifact = JSON.parse(readFileSync(resolve(ROOT, 'out/CascadeVault.sol/CascadeVault.json')));
    const vault = new Contract(address, artifact.abi, deployer);
    const token = new Contract(config.usdc, [
      'function allowance(address,address) view returns (uint256)',
      'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)',
      'function transfer(address,uint256) returns (bool)', 'function approve(address,uint256) returns (bool)',
    ], deployer);
    if (Number(await token.decimals()) !== 6) throw Error('USDC must have six ERC-20 decimals');
    if (getAddress(await vault.usdc()) !== getAddress(config.usdc)) throw Error('Vault USDC mismatch');
    if (getAddress(await vault.owner()) !== deployerAddress) throw Error('Deployer must be the checkpoint owner for this demo');
    const directory = resolve(values['state-dir'] ?? resolve(ROOT, '.demo-runs', keccak256(toUtf8Bytes(address + seed + mode + (target?.instance ?? '')))));
    const identity = { mode, chainId: config.chainId, vault: address, usdc: getAddress(config.usdc),
      deployer: deployerAddress, amount: amount.toString(), gasBudget: gasBudget.toString(),
      actors: actors.map(a => a.wallet.address) };
    const currentDay = await vault.today();
    const last = await vault.lastCheckpoint();
    checkCheckpoint(currentDay, last, values['zero-income-catch-up']);
    if ((await vault.balanceSheet()).deficit !== 0n) throw Error('Vault is underbacked');
    // Budget only steps not already journaled; Arc exposes one underlying asset at two precisions.
    const recorded = label => existsSync(resolve(directory, keccak256(toUtf8Bytes(label)) + '.json'));
    const gasSteps = mode === 'local' ? 0 : actors.filter(a => !recorded('Gas funding ' + a.name)).length;
    const principalRequired = mode === 'local' || recorded('Principal funding Apple') ? 0n : amount;
    if (mode === 'local' && !recorded('Apple issues to Samsung Display') && await token.balanceOf(actors[0].wallet.address) < amount) throw Error('Apple needs more mock USDC; restart setup or mint locally');
    if (mode === 'local') {
      for (const actor of actors) if (await provider.getBalance(actor.wallet.address) < gasBudget) throw Error('Actor lacks local gas funding; use the setup seed');
    }
    const required = principalRequired * 10n ** 12n + gasBudget * BigInt(gasSteps) + parseUnits('0.2', 18);
    if (await provider.getBalance(deployerAddress) < required) throw Error('Insufficient deployer native USDC budget');
    if (await token.balanceOf(deployerAddress) < principalRequired) throw Error('Insufficient ERC-20 principal');
    const run = openRun(directory, identity, currentDay);
    const maturity = BigInt(run.day) + 90n; const extended = BigInt(run.day) + 120n;
    if (currentDay >= maturity) throw Error('Run has reached maturity; refuse to change the original story');
    for (const actor of actors) actor.signer = actor.wallet.connect(provider);
    async function fees() {
      const data = await provider.getFeeData();
      const offered = data.maxFeePerGas ?? data.gasPrice ?? 0n;
      return { maxFeePerGas: offered < 20_000_000_000n ? 20_000_000_000n : offered * 2n,
        maxPriorityFeePerGas: 1_000_000_000n };
    }
    async function send(label, signer, populate) {
      return journaledSend({ directory, label, signer, request: async () => populate(await fees()),
        provider, explorer: values.live ? config.explorer : rpc });
    }
    async function catchUp() {
      const current = await vault.today(); const last = await vault.lastCheckpoint();
      checkCheckpoint(current, last, values['zero-income-catch-up']);
      for (let day = last + 1n; day <= current; day++)
        await send(`Zero-income checkpoint ${day}`, deployer, f => vault.checkpoint.populateTransaction(0, f));
    }
    if (mode !== 'local') {
      for (const actor of actors) {
        await send(`Gas funding ${actor.name}`, deployer, f => ({ to: actor.wallet.address, value: gasBudget, ...f }));
      }
      await send('Principal funding Apple', deployer, f => token.transfer.populateTransaction(actors[0].wallet.address, amount, f));
    }
    await send('Apple approves vault', actors[0].signer, f => token.connect(actors[0].signer).approve.populateTransaction(address, amount, f));
    if (!recorded('Apple issues to Samsung Display')) {
      if (await token.balanceOf(actors[0].wallet.address) < amount ||
          await token.allowance(actors[0].wallet.address, address) < amount) throw Error('Principal funding or approval did not take effect');
    }
    const invoices = [];
    for (let i = 0; i < 4; i++) {
      const due = i === 3 ? extended : maturity;
      const receipt = await send(`${actors[i+1].name} registers invoice: ${GOODS[i]}`, actors[i+1].signer, f =>
        vault.connect(actors[i+1].signer)['registerInvoice(address,uint256,uint32,uint32)'].populateTransaction(actors[i].wallet.address, amount, due, due, f));
      const event = receipt.logs.filter(log => log.address.toLowerCase() === address.toLowerCase())
        .map(log => { try { return vault.interface.parseLog(log); } catch { return null; } })
        .find(log => log?.name === 'InvoiceRegistered');
      if (!event) throw Error('Missing InvoiceRegistered event');
      invoices.push(event.args.invoiceId);
    }
    await catchUp();
    await send('Apple issues to Samsung Display', actors[0].signer, f => vault.connect(actors[0].signer).issue.populateTransaction(invoices[0], amount, f));
    for (let i = 1; i < 3; i++) {
      await send(`${actors[i].name} pays ${actors[i+1].name}`, actors[i].signer, f =>
        vault.connect(actors[i].signer)['pay(bytes32,uint256,uint256[],uint256)'].populateTransaction(invoices[i], amount, [maturity], amount, f));
    }
    await catchUp();
    await send('Silica supplier extends +90 to +120', actors[3].signer, f => vault.connect(actors[3].signer).extend.populateTransaction(amount, maturity, extended, f));
    await send('Silica supplier pays Freight carrier', actors[3].signer, f =>
      vault.connect(actors[3].signer)['pay(bytes32,uint256,uint256[],uint256)'].populateTransaction(invoices[3], amount, [extended], amount, f));
    for (const id of invoices) if ((await vault.invoices(id)).outstanding !== 0n) throw Error('Invoice did not settle');
    if (await vault.balanceOf(actors[4].wallet.address, extended) !== amount) throw Error('Final principal mismatch');
    const sheet = await vault.balanceSheet();
    if (sheet.deficit !== 0n) throw Error('Backing invariant failed');
    console.log(`Settled ${formatUnits(amount*4n,6)} USDC using ${formatUnits(amount,6)} USDC principal.`);
    console.log(`Vault: ${values.live ? config.explorer : rpc}/address/${address}`);
    console.log('Yield intervals are recorded. Day+90/day+120 claim and maturity require real UTC time.');
  } finally { provider.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.shortMessage ?? error.message); process.exitCode = 1; });
}
