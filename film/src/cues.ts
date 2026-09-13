/** W2 final-cut decisions: presentation reveals use measured narration onsets.
 * Editorial headings follow their spoken clause; locked scenes retain their timings.
 * Phrases stay in narration order so repeated words select the intended occurrence.
 */
export interface CuePhrase {cue: string; phrase: string}
export const CUE_PHRASES: Record<number, CuePhrase[]> = {
  1: [{cue: 'phone-reveal', phrase: 'foldable'}, {cue: 'phone-reveal-fallback', phrase: 'iPhone'}],
  2: [
    {cue: 'hook-open', phrase: '$200'},
    {cue: 'stat-cost', phrase: 'billion'},
    {cue: 'stat-suppliers', phrase: '200'},
    {cue: 'stat-factories', phrase: 'Thousands'},
    {cue: 'stat-countries', phrase: '50'},
    {cue: 'promises', phrase: 'payment terms'},
    {cue: 'promises-fallback', phrase: 'promises'},
    {cue: 'wordmark', phrase: 'Cascade'},
    {cue: 'hook-arc', phrase: 'on ARK'},
  ],
  3: [{cue: 'example-labels', phrase: 'obligation'}, {cue: 'example-labels-fallback', phrase: 'waits'}],
  4: [
    {cue: 'question-card', phrase: 'form'},
    {cue: 'question-card-fallback', phrase: 'move'},
    {cue: 'dated-dollar', phrase: 'dated'},
    {cue: 'dated-dollar-fallback', phrase: 'dollar'},
    {cue: 'not-cash', phrase: 'cash'},
  ],
  5: [
    {cue: 'cascade-open', phrase: 'Watch'},
    {cue: 'same-dollars', phrase: 'same dated dollars'},
    {cue: 'nine-invoices', phrase: 'Nine invoices'},
    {cue: 'window-mirror', phrase: '$450 million'},
  ],
  6: [
    {cue: 'deposited-value', phrase: '$100 million'},
    {cue: 'committed-counter', phrase: 'deposited'},
    {cue: 'transacted-value', phrase: '$450 million'},
    {cue: 'settled-counter', phrase: 'transacted'},
    {cue: 'invoice-value', phrase: 'Nine'},
    {cue: 'companies-counter', phrase: 'invoices'},
    {cue: 'invoices-settled', phrase: 'settled'},
  ],
  7: [
    {cue: 'coin', phrase: 'Dollars'},
    {cue: 'coin-pair', phrase: 'same date'},
    {cue: 'swap', phrase: 'interchangeable'},
    {cue: 'coin-principal', phrase: 'one USDC'},
    {cue: 'coin-date', phrase: 'calendar date'},
    {cue: 'earlier-pays-later', phrase: 'earlier'},
    {cue: 'face-value', phrase: 'face value'},
    {cue: 'extend', phrase: 'push'},
    {cue: 'coin-yield', phrase: 'yield'},
    {cue: 'final-card', phrase: 'One dollar'},
    {cue: 'final-date', phrase: 'One date'},
  ],
  8: [
    {cue: 'backing-card', phrase: 'Vault'},
    {cue: 'contract', phrase: 'ERC'},
    {cue: 'contract-fallback', phrase: '1155'},
    {cue: 'maturity-day', phrase: 'UTC maturity day'},
    {cue: 'reserve', phrase: 'USYC'},
    {cue: 'reserve-role', phrase: 'yield bearing reserve'},
    {cue: 'window-flatten', phrase: 'reserve'},
  ],
  9: [
    {cue: 'window-center', phrase: 'Now'},
    {cue: 'push-in-scrubber', phrase: 'zoom out'},
    {cue: 'pan-to-ledger', phrase: 'invoices'},
    {cue: 'pan-to-ledger-fallback', phrase: 'Thousands'},
    {cue: 'pull-back-full', phrase: 'countries'},
    {cue: 'pull-back-full-fallback', phrase: 'across'},
    {cue: 'stress-flash', phrase: 'Separately'},
    {cue: 'stress-flash-fallback', phrase: 'tested'},
    {cue: 'stress-operations', phrase: '10 000'},
    {cue: 'stress-end', phrase: "That's where"},
    {cue: 'ui-origin', phrase: 'interface'},
  ],
  10: [
    {cue: 'zoom-out-again', phrase: 'Now'},
    {cue: 'word-loans', phrase: 'Loans'},
    {cue: 'word-forwards', phrase: 'forwards'},
    {cue: 'word-bonds', phrase: 'bonds'},
    {cue: 'word-derivatives', phrase: 'derivatives'},
    {cue: 'wordmark', phrase: 'Cascade'},
    {cue: 'money-plus-time', phrase: 'money plus time'},
    {cue: 'money-plus', phrase: 'plus'},
    {cue: 'money-time', phrase: 'time'},
  ],
  11: [{cue: 'chain-reveal', phrase: 'invisible'}, {cue: 'promises', phrase: 'promises'}, {cue: 'cascade-would', phrase: 'Cascade'}],
  12: [{cue: 'wordmark', phrase: 'Cascade'}],
};

/** Scene-local seconds; W2 rebuilt scenes have zero anticipation lead. */
export type CueTimes = Record<number, Record<string, number>>;

/** One scene's slice of CueTimes — what a motion-graphics component actually receives. */
export type SceneCues = Record<string, number> | undefined;

/**
 * Resolve one cue to a scene-local FRAME. Falls back to `fallbackFrame` (the
 * component's own historical fixed offset) when this cue has no resolved
 * narration timestamp for this scene — a missing generated/cues.json, a
 * scene with no words file yet, or a phrase this VO cut never speaks are
 * all the same case: do nothing different from before.
 */
export const cueFrame = (
  cues: SceneCues,
  cue: string,
  fps: number,
  fallbackFrame: number,
): number => {
  const sec = cues?.[cue];
  return sec === undefined ? fallbackFrame : Math.max(0, Math.round(sec * fps));
};
