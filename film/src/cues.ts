/**
 * cues.ts — names every motion-graphic slide reveal / card that should track
 * the narration instead of a fixed frame offset, and the exact phrase (from
 * the real spoken VO, not the v6 script draft — the two differ in places)
 * whose first word marks when that reveal should fire.
 *
 * `scripts/cues-from-words.mjs` resolves each phrase against that scene's
 * word-timestamp JSON (whisper word-level output: {word, start, end} in
 * seconds from the scene's own clip start) and writes
 * `src/generated/cues.json` as `{[scene]: {[cue]: seconds}}`. A phrase that
 * isn't found in the transcript (not spoken in this cut, or the words file
 * doesn't exist yet) is simply absent from that output — see cueFrame()
 * below, which falls back to the CALLER's own fixed offset in that case, so
 * an unresolved cue is a no-op, not an error.
 *
 * Matching is ORDER-SENSITIVE per scene: the resolver walks each scene's
 * cue list top-to-bottom, searching forward from the end of the previous
 * cue's match, so a repeated word (e.g. scene 14 says "money" once at 7.72s
 * that ISN'T the "money plus time" beat, then again at 12.40s as part of
 * it) resolves to the right occurrence rather than the first.
 *
 * Two scenes were deliberately left with fewer cues than they have visual
 * beats — not an oversight:
 *   - Scene 8's "four companies" counter and scene 14's closing "a second
 *     dimension to money" card are not spoken at all in this narration cut
 *     (docs/cascade/hackathon vs. the recorded v7 VO diverged) — their
 *     phrases are listed so a future re-narration picks them up
 *     automatically, but today they always fall back.
 *   - Scene 13's persistent "10,000 operations · 0 violations" footer and
 *     all of scene 17's close card are excluded entirely (no cue defined).
 *     Scene 13's footer is a documented fix (verified issue #1): it is
 *     PINNED to the bottom for the whole scene by design, not a beat that
 *     should wait for its own number to be spoken. Scene 17's three beats
 *     (tagline -> wordmark -> "Dated dollars on Arc.") are a deliberate
 *     held dramatic sequence timed off the scene's own duration; the
 *     actual VO is now four words ("This is Cascade Money.") spoken almost
 *     entirely in the first two seconds, so anchoring the wordmark to the
 *     word "Cascade" would collapse the sequence instead of pacing it.
 */
export interface CuePhrase {
  /** Stable name for this reveal — referenced from the motion-graphics component via cueFrame(). */
  cue: string;
  /** The exact words (case-insensitive) to find, in order, in the scene's word-timestamp JSON. */
  phrase: string;
}

export const CUE_PHRASES: Record<number, CuePhrase[]> = {
  // Scene 1 — The object of desire: the folding-phone hero image fades in
  // over the app window on the line naming the product. The v7 VO says
  // "the first foldABLE iPhone, the iPhone Duo" — not "folding" — so the
  // cue anchors to the first spoken "iPhone" (the film's first mention of
  // the product by name), the same beat scene1PhoneRevealFrame's word-count
  // fallback in CascadeFilm.tsx was already estimating.
  1: [{cue: 'phone-reveal', phrase: 'iPhone'}],
  // Scene 3 — Rewind: date card, then the four stat lines.
  3: [
    {cue: 'date-card', phrase: 'September 2025'},
    {cue: 'stat-suppliers', phrase: '200 suppliers'},
    {cue: 'stat-factories', phrase: 'thousands of factories'},
    {cue: 'stat-countries', phrase: '50 countries'},
    {cue: 'stat-cost', phrase: '$200 billion'},
  ],
  // Scene 5 — The contradiction: the two receivable/payable rows, then the punchline.
  5: [
    {cue: 'rows-in', phrase: 'Samsung can have'},
    {cue: 'dates-line', phrase: "the dates just don't line up"},
  ],
  // Scene 6 — The question: one card, reveals on the opening line.
  6: [{cue: 'question-card', phrase: 'So what if that future payment could move today'}],
  // Scene 8 — Let it land: the two dollar counters, the company counter (not
  // spoken — see file header), then the tagline.
  8: [
    {cue: 'committed-counter', phrase: '$100 million committed'},
    {cue: 'settled-counter', phrase: '$400 million'},
    {cue: 'companies-counter', phrase: 'four companies'},
    {cue: 'tagline', phrase: 'that is the cascade'},
  ],
  // Scene 9 — Run the year: three rostrum-camera moves on the capture layer
  // (Liam round 2, msg 21778). Each primary phrase is followed immediately
  // by its fallback phrase so a future re-narration that drops the primary
  // word still resolves (cursor only advances on a successful match, so the
  // fallback search starts from the same point the primary's would have).
  9: [
    {cue: 'push-in-scrubber', phrase: 'simulation'},
    {cue: 'pan-to-ledger', phrase: 'invoices'},
    {cue: 'pan-to-ledger-fallback', phrase: 'Thousands'},
    {cue: 'pull-back-full', phrase: 'countries'},
    {cue: 'pull-back-full-fallback', phrase: 'across'},
  ],
  // Scene 12 — Stress test: the kicker, then each competing operation as it's named.
  12: [
    {cue: 'kicker', phrase: 'maturity day'},
    {cue: 'op-extensions', phrase: 'thousands of extensions'},
    {cue: 'op-transfers', phrase: 'transfers'},
    {cue: 'op-redemptions', phrase: 'redemptions'},
    {cue: 'op-sales', phrase: 'sales'},
  ],
  // Scene 13 — The rules survive: the two laws (the persistent ops/violations footer is excluded — see file header).
  13: [
    {cue: 'law-ownership', phrase: 'every dollar of income has exactly one owner'},
    {cue: 'law-yield', phrase: 'no two yield claims overlap'},
  ],
  // Scene 14 — Zoom out: the four word-chips, then "money plus time" (the
  // closing "a second dimension to money" card is not spoken — see file header).
  14: [
    {cue: 'word-loans', phrase: 'Loans'},
    {cue: 'word-forwards', phrase: 'forwards'},
    {cue: 'word-bonds', phrase: 'bonds'},
    {cue: 'word-derivatives', phrase: 'derivatives'},
    {cue: 'money-plus-time', phrase: 'money plus time'},
    {cue: 'final-line', phrase: 'a second dimension to money'},
  ],
};

/** scene number -> cue name -> resolved seconds-from-scene-start (word start minus 150ms), written by cues-from-words.mjs. */
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
