import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function loadConfig(path) {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (!Number.isSafeInteger(config.chainId) || config.chainId <= 0) throw Error('Configure a verified chainId');
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.usdc ?? '')) throw Error('Configure a verified USDC address');
  for (const key of ['rpcUrl', 'explorer', 'verifierUrl']) {
    const url = new URL(config[key]);
    if (!['https:', 'http:'].includes(url.protocol)) throw Error(`Invalid ${key}`);
  }
  return config;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadConfig(process.argv[2]);
}
