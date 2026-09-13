/** ERC-1155 IDs use the same UTC epoch-day arithmetic as CascadeVault.today(). */
export const UTC_DAY_MS = 86_400_000;
export function utcDayId(tMs: number): number {
  if (!Number.isFinite(tMs) || tMs < 0 || Math.floor(tMs / UTC_DAY_MS) > 0xffff_ffff) throw Error('UTC timestamp outside contract date range');
  return Math.floor(tMs / UTC_DAY_MS);
}
export function utcDate(id: number): string {
  if (!Number.isSafeInteger(id) || id < 0) throw Error('Invalid date ID');
  return new Date(id * UTC_DAY_MS).toISOString().slice(0, 10);
}
export function midnightCountdown(tMs: number): string {
  const remaining = Math.ceil(((utcDayId(tMs) + 1) * UTC_DAY_MS - tMs) / 1000);
  return [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60].map(n => String(n).padStart(2, '0')).join(':');
}
export function snapshotUtcMs(blockUtcMs: number, tMs: number, referenceTMs: number): number {
  return blockUtcMs + Math.max(0, tMs - referenceTMs);
}
export function tokenLabel(id: number, today: number): string {
  return id <= today ? 'USD spot' : `USD+${id - today}`;
}
export type DateTokenMetadata = { name: string; description: string; decimals: number; image: string };
function decodeBase64(value: string): string {
  if (!value || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw Error('Invalid metadata base64');
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)));
}
/** Decode eth_call's ABI dynamic string without accepting truncated or offset-forged data. */
export function decodeAbiString(hex: string): string {
  if (!/^0x(?:[0-9a-f]{64}){2,}$/i.test(hex)) throw Error('Invalid ABI string');
  const data = hex.slice(2), offset = BigInt(`0x${data.slice(0, 64)}`), length = BigInt(`0x${data.slice(64, 128)}`);
  if (offset !== 32n || length > 1_000_000n) throw Error('Invalid ABI string bounds');
  const size = Number(length), padded = Math.ceil(size / 32) * 64;
  if (data.length !== 128 + padded || !/^0*$/.test(data.slice(128 + size * 2))) throw Error('Invalid ABI string padding');
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(data.slice(128, 128 + size * 2).match(/../g) ?? [], byte => parseInt(byte, 16)));
}
export function decodeDateMetadata(uri: string): DateTokenMetadata {
  const prefix = 'data:application/json;base64,';
  if (!uri.startsWith(prefix)) throw Error('Unsupported metadata URI');
  const parsed: unknown = JSON.parse(decodeBase64(uri.slice(prefix.length)));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid date metadata');
  const value = parsed as Record<string, unknown>;
  if (typeof value.name !== 'string' || !/^USD(?: spot|\+[1-9][0-9]*)$/.test(value.name) || typeof value.description !== 'string' || value.decimals !== 6 || typeof value.image !== 'string' || !value.image.startsWith('data:image/svg+xml;base64,')) throw Error('Invalid date metadata fields');
  if (!decodeBase64(value.image.slice('data:image/svg+xml;base64,'.length)).startsWith('<svg')) throw Error('Invalid token image');
  return { name: value.name, description: value.description, decimals: value.decimals, image: value.image };
}
