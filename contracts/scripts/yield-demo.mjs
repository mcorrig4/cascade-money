import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Contract, ContractFactory, JsonRpcProvider, NonceManager, parseUnits, formatUnits } from 'ethers';
import { demoAccounts } from './demo.mjs';
import { FORK_RPC, LOCAL_SEED, assertFork, signingWallet } from './local.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const {values} = parseArgs({options:{rpc:{type:'string'}, seed:{type:'string',default:LOCAL_SEED},
  amount:{type:'string',default:'10'}, live:{type:'boolean',default:false}}});
if (values.live) throw Error('yield-demo is fork-only: mock prices and time travel must never run on live Arc');
const rpc = values.rpc ?? process.env.CASCADE_FORK_RPC ?? FORK_RPC;
const provider = new JsonRpcProvider(rpc);
const artifact = name => JSON.parse(readFileSync(resolve(root,`out/${name}.sol/${name}.json`)));
try {
  await assertFork(provider,rpc);
  const owner = new NonceManager(signingWallet(provider,false));
  const actors = demoAccounts(values.seed).map(a=>({...a, signer:new NonceManager(a.wallet.connect(provider))}));
  const [apple,samsung,corning,silica,freight] = actors;
  const amount = parseUnits(values.amount,6);
  if (amount <= 0n) throw Error('Amount must be positive');
  const tokenAddress = '0x3600000000000000000000000000000000000000';
  const usdc = new Contract(tokenAddress,[
    'function transfer(address,uint256) returns(bool)',
    'function approve(address,uint256) returns(bool)',
    'function balanceOf(address) view returns(uint256)'
  ],owner);
  if (await usdc.balanceOf(await owner.getAddress()) < amount * 10n ||
      await usdc.balanceOf(apple.wallet.address) < amount) throw Error('Run fork.sh to fund owner and Apple first');
  async function mine(label,promise) {
    const tx = await promise;
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw Error(label + ' reverted');
    console.log(label + ': ' + receipt.hash);
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
    const [b,p,y,r,d] = await vault.balanceSheet();
    const units = v=>formatUnits(v,6);
    console.log(`SHEET ${label}: backing=${units(b)} principal=${units(p)} accrued=${units(y)} reserve=${units(r)} deficit=${units(d)} index=${formatUnits(await vault.indexAt(await vault.lastCheckpoint()),18)}`);
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
  console.log('LOCAL DEMO COMPLETE: mock prices and accelerated Anvil time; no real USYC yield.');
} finally { provider.destroy(); }
