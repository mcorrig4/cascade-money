// Story-relevance filter for the baked stream (product decision, coordinator
// 2026-09-12): most of the file's remaining bulk after field projection is
// claim/extend/withdraw/funding_shortfall events that never touch a story's
// camera accounts and fall well outside the first week. Those four "internal"
// types are dropped unless they touch a story camera account (or Apple) or
// land in the first week; every other type (arcs/ledger/chart/scrubber
// producers) is always kept. If that alone isn't enough, a further per-day
// top-200-by-amount cap on the same four types is applied.
//
// Dropping events changes which `seq` values exist, so kept events are
// renumbered to a new consecutive sequence (1..N) in their original relative
// order — the loader (src/data/index.ts) requires strictly consecutive,
// nondecreasing seq per day, but never binds seq to any value outside the
// stream itself, so renumbering is transparent to every consumer.

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export const ALWAYS_KEEP = new Set([
  'run_started', 'run_completed', 'day_opened', 'day_summary', 'checkpoint',
  'story', 'invoice_registered', 'issue', 'pay', 'transfer', 'sell',
]);
export const INTERNAL_FOUR = new Set(['claim', 'extend', 'withdraw', 'funding_shortfall']);
export const FIRST_WEEK_DAY = 7;
export const PER_DAY_CAP = 200;

/** Pass 1: collect the union of story camera accounts, plus Apple, from the raw source. */
export async function collectCameraAccounts(sourcePath) {
  const accounts = new Set(['Apple']);
  for await (const line of createInterface({ input: createReadStream(sourcePath), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type !== 'story') continue;
    const cameraAccounts = event.data?.camera_accounts;
    if (Array.isArray(cameraAccounts)) for (const account of cameraAccounts) accounts.add(String(account));
  }
  return accounts;
}

/** Whether one of the four internal types survives the story-relevance filter. */
export function keepInternalEvent(event, cameraAccounts) {
  const accounts = Array.isArray(event.accounts) ? event.accounts : [];
  const touchesStory = accounts.some(account => cameraAccounts.has(account));
  return touchesStory || Number(event.day) <= FIRST_WEEK_DAY;
}

/** Decide whether a raw (unprojected) event survives the type + story-relevance filter. */
export function keepEvent(event, cameraAccounts) {
  if (ALWAYS_KEEP.has(event.type)) return true;
  if (INTERNAL_FOUR.has(event.type)) return keepInternalEvent(event, cameraAccounts);
  return true; // unknown future types: fields already collapse to {} by projection; never drop the record itself (seq contract).
}

/**
 * Cap the four internal types to the PER_DAY_CAP largest-amount events per
 * day, keeping every other kept event untouched. Operates on already-kept,
 * already-projected events (each `{ raw, projected }`), in original order.
 */
export function capPerDay(keptEvents, cap = PER_DAY_CAP) {
  const byDay = new Map();
  for (const entry of keptEvents) {
    if (!INTERNAL_FOUR.has(entry.projected.type)) continue;
    const day = entry.projected.day;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(entry);
  }
  const dropped = new Set();
  for (const entries of byDay.values()) {
    if (entries.length <= cap) continue;
    const sorted = [...entries].sort((a, b) => Number(b.projected.amount_cents) - Number(a.projected.amount_cents));
    for (const entry of sorted.slice(cap)) dropped.add(entry);
  }
  return keptEvents.filter(entry => !dropped.has(entry));
}
