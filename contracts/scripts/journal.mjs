import { mkdirSync, readFileSync, writeFileSync, linkSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { keccak256, toUtf8Bytes } from 'ethers';

// Publish a complete file atomically; concurrent resumptions use the first durable transaction.
export function immutableJson(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  try { linkSync(temp, path); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  finally { unlinkSync(temp); }
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function openRun(directory, identity, day) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const metadata = immutableJson(resolve(directory, 'run.json'), { identity, day: String(day) });
  if (JSON.stringify(metadata.identity) !== JSON.stringify(identity)) throw Error('Run identity mismatch; use the original seed, vault and amounts');
  return metadata;
}
export async function journaledSend({ directory, label, signer, request, provider, explorer }) {
  const path = resolve(directory, keccak256(toUtf8Bytes(label)) + '.json');
  let entry;
  try { entry = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const transaction = await request();
    transaction.nonce = Number(await provider.send('eth_getTransactionCount', [await signer.getAddress(), 'pending']));
    const populated = await signer.populateTransaction(transaction);
    const raw = await signer.signTransaction(populated);
    entry = immutableJson(path, { label, raw, hash: keccak256(raw) });
  }
  if (entry.label !== label || keccak256(entry.raw) !== entry.hash) throw Error('Corrupt transaction journal');
  console.log(`${label}: ${explorer}/tx/${entry.hash}`);
  let receipt = await provider.getTransactionReceipt(entry.hash);
  if (!receipt) {
    try { await provider.broadcastTransaction(entry.raw); }
    catch (error) {
      // A previously submitted transaction can already be pending or mined.
      if (!await provider.getTransaction(entry.hash) && !await provider.getTransactionReceipt(entry.hash)) throw error;
    }
    receipt = await provider.waitForTransaction(entry.hash, 1, 120_000);
  }
  if (!receipt) throw Error('Transaction pending; resume this same run');
  if (receipt.status !== 1) throw Error(`Recorded transaction reverted: ${entry.hash}. Refusing automatic replacement.`);
  return receipt;
}
