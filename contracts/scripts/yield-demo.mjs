import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Contract, ContractFactory, JsonRpcProvider, NonceManager, parseUnits } from 'ethers';
import { demoAccounts } from './demo.mjs';
import { LOCAL_SEED, assertFork, assertLocal, signingWallet, localTarget, writeLocal, warnFork } from './local.mjs';
import { balanceSheetJSON, rational } from './balance-sheet.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const {values} = parseArgs({options:{rpc:{type:'string'}, seed:{type:'string'},
  amount:{type:'string',default:'10'}, fork:{type:'boolean',default:false}, 'dry-run':{type:'boolean',default:false}, live:{type:'boolean',default:false}}});
if (values.live) throw Error('yield-demo is local-only: mock prices and time travel must never run on live Arc');
const target = localTarget(values);
if (values.fork) warnFork();
const rpc = target.rpc;
const seed = values.seed ?? process.env.CASCADE_DEMO_SEED ?? target.seed ?? LOCAL_SEED;
const amount = parseUnits(values.amount,6);
if (amount <= 0n) throw Error('Amount must be positive');
if (values['dry-run']) {
  writeLocal('yield-demo.dry-run.json', { dryRun: true, mode: target.mode, chainId: target.chainId, rpc, usdc: target.usdc, seed, amount: amount.toString(), checkpoints: 5 });
  const sample = { dryRun: true, label: 'schema preview; no chain data', day: 0, index: '0/1', active_entitlements: [],
    balance_sheet: balanceSheetJSON({ backing: 0n, principal: 0n, spot: 0n, accruedScaled: 0n, claimableScaled: 0n, reserve: 0n, deficit: 0n, shares: 0n }) };
  writeFileSync(resolve(root,'.local/yield-demo.dry-run.ndjson'), JSON.stringify(sample)+'\n');
  console.log(JSON.stringify(sample));
  process.exit(0);
}
const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
const artifact = name => JSON.parse(readFileSync(resolve(root,`out/${name}.sol/${name}.json`)));
try {
  await (values.fork ? assertFork : assertLocal)(provider,rpc);
  const owner = new NonceManager(signingWallet(provider,false));
  const actors = demoAccounts(seed).map(a=>({...a, signer:new NonceManager(a.wallet.connect(provider))}));
  const [apple,samsung,corning,silica,freight] = actors;
  const tokenAddress = target.usdc;
  if (await provider.getCode(tokenAddress) === '0x') throw Error('USDC code missing');
  const usdc = new Contract(tokenAddress,[
    'function transfer(address,uint256) returns(bool)',
    'function approve(address,uint256) returns(bool)',
    'function balanceOf(address) view returns(uint256)', 'function decimals() view returns(uint8)'
  ],owner);
  if (Number(await usdc.decimals()) !== 6) throw Error('USDC must use six decimals');
  for (const signer of [owner, ...actors.map(a=>a.signer)]) {
    if (await provider.getBalance(await signer.getAddress()) < parseUnits('0.01',18)) throw Error('Local account lacks native gas funding');
  }
  for (const name of ['MockUSYC','CascadeVaultUSYC']) artifact(name);
  if (await usdc.balanceOf(await owner.getAddress()) < amount * 10n ||
      await usdc.balanceOf(apple.wallet.address) < amount) throw Error('Run local-chain.sh to fund the owner and Apple; Arc fork native-USDC funding is unsupported');
  const output = resolve(root,'.local/yield-demo.ndjson');
  mkdirSync(resolve(root,'.local'),{recursive:true});
  writeFileSync(output,'');
  const touchedDates = new Set();
  async function mine(label,promise) {
    const tx = await promise;
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw Error(label + ' reverted');
    console.log(label + ': ' + receipt.hash);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== vault.target.toLowerCase()) continue;
      const event = vault.interface.parseLog(log);
      if (event?.name === 'TransferSingle') touchedDates.add(event.args.id.toString());
      if (event?.name === 'TransferBatch') for (const id of event.args.ids) touchedDates.add(id.toString());
    }
    return receipt;
  }
  async function deploy(name,args) {
    const a = artifact(name);
    const instance = await new ContractFactory(a.abi,a.bytecode.object,owner).deploy(...args);
    await instance.waitForDeployment();
    console.log(name + ' (local only): ' + await instance.getAddress());
    return instance;
  }
  const asset = await deploy('MockUSYC',[tokenAddress,await owner.getAddress()]);
  const vault = await deploy('CascadeVaultUSYC',[await asset.getAddress(),await owner.getAddress(),0]);
  await mine('Fund mock Teller redemption liquidity',usdc.transfer(await asset.getAddress(),amount * 10n));
  await mine('Apple approves mock Teller',usdc.connect(apple.signer).approve(await asset.getAddress(),amount));
  await mine('Apple buys Mock USYC',asset.connect(apple.signer).buy(amount));
  await mine('Apple approves USYC vault',asset.connect(apple.signer).approve(await vault.getAddress(),amount));
  const day = await vault.today();
  const maturity = day + 3n, extended = day + 5n;
  async function sheet(label) {
    const [backing,principal,,reserve,deficit] = await vault.balanceSheet();
    const dayNow = await vault.today(), cutoff = await vault.lastCheckpoint();
    const accruedScaled = await vault.accruedScaled();
    let claimableScaled = 0n, spot = 0n;
    const active = [], unclaimed = [];
    const count = await vault.entitlementCount();
    for (let id=1n; id<=count; id++) {
      const e = await vault.entitlements(id);
      if (e.claimed) continue;
      const record = { id: id.toString(), account: e.account, amount_cents: Number(e.amount)/10000,
        start_day: Number(e.start), end_day: Number(e.end), claimable: cutoff >= e.end };
      unclaimed.push(record);
      if (e.start <= dayNow && e.end >= dayNow) active.push(record);
      if (cutoff >= e.end) claimableScaled += e.amount * (await vault.indexAt(e.end) - await vault.indexAt(e.start-1n));
    }
    for (const date of touchedDates) if (BigInt(date) <= dayNow) spot += await vault.supplyByDate(date);
    const row = { schema_version: 1, source: 'local-usyc-demo', mode: target.mode, label,
      chain_id: target.chainId, vault: await vault.getAddress(), day: Number(dayNow),
      iso_date: new Date(Number(dayNow)*86400000).toISOString().slice(0,10),
      checkpoint_day: Number(cutoff), index: rational(await vault.indexAt(cutoff),10n**18n),
      active_entitlements: active, unclaimed_entitlements: unclaimed,
      active_notional_cents: Number(await vault.activeNotional())/10000,
      balance_sheet: balanceSheetJSON({ backing,principal,spot,accruedScaled,claimableScaled,reserve,deficit,
        shares: await asset.balanceOf(await vault.getAddress()) }) };
    const line = JSON.stringify(row);
    appendFileSync(output,line+'\n');
    console.log(line);
  }
  async function invoice(creditor,debtor,due,annotation) {
    const receipt = await mine(annotation,vault.connect(creditor.signer)['registerInvoice(address,uint256,uint32,uint32)'](
      debtor.wallet.address,amount,due,due));
    const event = receipt.logs.filter(l=>l.address.toLowerCase() === vault.target.toLowerCase())
      .map(l=>{try{return vault.interface.parseLog(l);}catch{return null;}})
      .find(e=>e?.name==='InvoiceRegistered');
    if (!event) throw Error('Invoice event missing');
    return event.args.invoiceId;
  }
  const ids = [
    await invoice(samsung,apple,maturity,'Samsung Display invoices Apple: folding OLED panels'),
    await invoice(corning,samsung,maturity,'Corning invoices Samsung Display: ultra-thin cover glass'),
    await invoice(silica,corning,maturity,'Silica supplier invoices Corning: glass feedstock'),
    await invoice(freight,silica,extended,'Freight carrier invoices silica supplier: freight'),
  ];
  await mine('Apple issues to Samsung Display',vault.connect(apple.signer).issue(ids[0],amount));
  await sheet('Apple issue');
  await mine('Samsung Display pays Corning',vault.connect(samsung.signer)['pay(bytes32,uint256,uint256[],uint256)'](ids[1],amount,[maturity],amount));
  await sheet('Samsung Display pays Corning');
  async function checkpoint(offset,price) {
    await provider.send('evm_setNextBlockTimestamp',[Number((day+BigInt(offset))*86400n+60n)]);
    await mine('Mock price '+price,asset.setPrice(parseUnits(price,18)));
    await mine('Checkpoint day+'+offset,vault['checkpoint()']());
    await sheet('day+'+offset);
  }
  await checkpoint(1,'1.01');
  await mine('Corning pays silica supplier',vault.connect(corning.signer)['pay(bytes32,uint256,uint256[],uint256)'](ids[2],amount,[maturity],amount));
  await sheet('Corning pays silica supplier');
  const originalEntitlement = 1n;
  const extensionEntitlement = await vault.entitlementCount()+1n;
  await mine('Silica supplier extends day+3 to day+5',vault.connect(silica.signer).extend(amount,maturity,extended));
  await sheet('silica extends');
  await mine('Silica supplier pays freight carrier',vault.connect(silica.signer)['pay(bytes32,uint256,uint256[],uint256)'](ids[3],amount,[extended],amount));
  await sheet('silica pays freight');
  await checkpoint(2,'1.02');
  await checkpoint(3,'1.03');
  await mine('Apple claims original interval',vault.connect(apple.signer).claim(originalEntitlement));
  await sheet('Apple claim');
  await checkpoint(4,'1.04');
  await checkpoint(5,'1.05');
  await mine('Silica supplier claims added interval',vault.connect(silica.signer).claim(extensionEntitlement));
  await sheet('silica claim / freight principal is spot');
  await mine('Freight withdraws matured principal as USYC shares',vault.connect(freight.signer)['withdraw(uint256)'](amount));
  await sheet('freight withdrawal');
  await mine('Freight sells shares to mock Teller',asset.connect(freight.signer).sell(await asset.balanceOf(freight.wallet.address)));
  for (const id of ids) if ((await vault.invoices(id)).outstanding !== 0n) throw Error('Unsettled invoice');
  if ((await vault.balanceSheet()).deficit !== 0n) throw Error('Unexpected deficit');
  console.log('Balance sheet NDJSON: '+output);
  console.log('LOCAL DEMO COMPLETE: mock prices and accelerated Anvil time; no real USYC yield.');
} finally { provider.destroy(); }
