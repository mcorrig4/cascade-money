import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { JsonRpcProvider, Interface, keccak256, AbiCoder, toBeHex, parseUnits, getAddress } from 'ethers';
import { demoAccounts } from './demo.mjs';
import { assertFork, signingWallet, FORK_RPC, LOCAL_SEED } from './local.mjs';

const rpc = process.env.CASCADE_FORK_RPC ?? FORK_RPC;
const provider = new JsonRpcProvider(rpc);
const usdc = '0x3600000000000000000000000000000000000000';
const abi = new Interface(['function balanceOf(address) view returns(uint256)']);
const balance = async address => BigInt(await provider.send('eth_call', [{to:usdc,data:abi.encodeFunctionData('balanceOf',[address])}, 'latest']));
const slotFor = (address, slot) => keccak256(AbiCoder.defaultAbiCoder().encode(['address','uint256'], [address,slot]));
function storage(slot, value) {
  // Storage writes are deliberately confined to the verified loopback fork.
  execFileSync('cast', ['rpc', '--rpc-url', rpc, 'anvil_setStorageAt', usdc, slot, toBeHex(value,32)], {stdio:'pipe'});
}
try {
  await assertFork(provider, rpc);
  if (await provider.getCode(usdc) === '0x') throw Error('Fork has no USDC proxy code');
  const probe = getAddress('0x00000000000000000000000000000000ca5cade1');
  const sentinel = 123456789123n;
  let balanceSlot;
  const candidates = process.env.ARC_USDC_BALANCE_SLOT ? [BigInt(process.env.ARC_USDC_BALANCE_SLOT)] :
    Array.from({length:256}, (_,i) => BigInt(i));
  for (const candidate of candidates) {
    const key = slotFor(probe,candidate);
    const old = BigInt(await provider.send('eth_getStorageAt',[usdc,key,'latest']));
    try {
      storage(key,sentinel);
      if (await balance(probe) === sentinel) balanceSlot = candidate;
    } finally { storage(key,old); }
    if (balanceSlot !== undefined) break;
  }
  if (balanceSlot === undefined) throw Error('No verified balance slot in 0..255; supply ARC_USDC_BALANCE_SLOT after inspecting the proxy implementation');
  const deployer = signingWallet(provider, false);
  const actors = demoAccounts(process.env.CASCADE_DEMO_SEED ?? LOCAL_SEED);
  const accounts = [await deployer.getAddress(), ...actors.map(a=>a.wallet.address)];
  for (const address of accounts) {
    await provider.send('anvil_setBalance',[address,toBeHex(parseUnits('1000000',18))]);
    storage(slotFor(address,balanceSlot),parseUnits('1000000',6));
    if (await balance(address) !== parseUnits('1000000',6)) throw Error('USDC funding verification failed');
    console.log('Fork funded: ' + address);
  }
  const root = fileURLToPath(new URL('..',import.meta.url));
  mkdirSync(resolve(root,'.local'),{recursive:true});
  writeFileSync(resolve(root,'.local/fork.json'), JSON.stringify({rpc,chainId:5042002,usdc,
    instance:randomUUID(),balanceSlot:balanceSlot.toString(),accounts},null,2)+'\n');
  console.log('Verified USDC balance mapping slot: ' + balanceSlot);
  console.log('Local storage deal only; mock funding does not alter live USDC supply.');
} finally { provider.destroy(); }
