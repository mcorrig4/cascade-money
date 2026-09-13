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
 * cue's match, so a repeated word (e.g. scene 10 says "money" once at 7.72s
 * that ISN'T the "money plus time" beat, then again at 12.40s as part of
 * it) resolves to the right occurrence rather than the first.
 *
 * Numbers throughout this file are the NEW (post scene-11-delete pass,
 * 2026-09-13) 12-scene numbering — scene 11 ("New York" in the prior
 * 13-scene numbering) is cut, so old scene 12 (Beneath it) and 13 (Close)
 * are now 11 and 12. One scene was deliberately left with fewer cues
 * than it has visual beats — not an oversight:
 *   - Scene 10's closing "a second dimension to money" card is not spoken
 *     at all in this narration cut (docs/cascade/hackathon vs. the
 *     recorded v7 VO diverged) — its phrase is listed so a future
 *     re-narration picks it up automatically, but today it always falls
 *     back. (Scene 6's counters, previously in the same boat under the v7
 *     cut, are now keyed to the v9 narration's actual words — see the
 *     scene 6 entry below.)
 *   - Scene 9's closing StressResultFlash and all of scene 12's close card
 *     are excluded entirely (no cue defined). The old scene 13 (The rules
 *     survive) footer this note used to describe is cut as a standalone
 *     scene (reorder-to-13 pass) — its headline figure now lives in scene
 *     9's StressResultFlash, not narration-keyed. Scene 12's (Close, old
 *     17) three beats (tagline -> wordmark -> "Dated dollars on Arc.") are
 *     a deliberate held dramatic sequence timed off the scene's own
 *     duration; the actual VO is now four words ("This is Cascade
 *     Money.") spoken almost entirely in the first two seconds, so
 *     anchoring the wordmark to the word "Cascade" would collapse the
 *     sequence instead of pacing it.
 */
export interface CuePhrase {
  /** Stable name for this reveal — referenced from the motion-graphics component via cueFrame(). */
  cue: string;
  /** The exact words (case-insensitive) to find, in order, in the scene's word-timestamp JSON. */
  phrase: string;
}

export const CUE_PHRASES: Record<number, CuePhrase[]> = {
  // Scene 2 — The hook (round 3, product owner's brief 2026-09-13, msg
  // 21865): the v9 cold-open line is now Liam's real recorded take
  // (film/public/narration/scene-02.wav, words at
  // cascade-narration/words-merged/scene-02.json), so every phrase below
  // resolves against real narration timestamps instead of falling back to
  // the even fixed-fraction slots (see Hook.tsx).
  //   "You know what's crazy? Nearly two hundred billion dollars of product
  //   costs. Two hundred suppliers, thousands of factories, fifty
  //   countries. All of it running on payment terms and promises. Cascade
  //   Money settles those terms on Arc. Let me show you, with Apple."
  2: [
    {cue: 'hook-open', phrase: 'crazy'},
    {cue: 'stat-cost', phrase: 'billion'},
    {cue: 'stat-suppliers', phrase: 'suppliers'},
    // Round 5 (Liam 2026-09-13, reply 21910: "don't show all three facts
    // in a single reveal ... they should appear as I say them ... same
    // with staggering the citations"): the three facts each get their own
    // cue now instead of sharing 'stat-suppliers' as a single combined
    // line, so 'stat-factories' resolves against its own spoken word
    // rather than piggybacking on the countries chip's old fallback.
    {cue: 'stat-factories', phrase: 'factories'},
    {cue: 'stat-countries', phrase: 'countries'},
    {cue: 'promises', phrase: 'promises'},
    {cue: 'wordmark', phrase: 'Cascade'},
    {cue: 'apple-cta', phrase: 'Apple'},
  ],
  // Scene 1 — The object of desire (round 3, product owner's brief
  // 2026-09-13 v2): the phone strobes in and lands on the word "foldable"
  // ("The first foldable iPhone."). Fallback is the first spoken "iPhone"
  // (round 2's anchor, and scene1PhoneRevealFrame's word-count estimate
  // below it) for a re-narration that drops "foldable" but still names the
  // product.
  1: [
    {cue: 'phone-reveal', phrase: 'foldable'},
    {cue: 'phone-reveal-fallback', phrase: 'iPhone'},
  ],
  // Old scenes 3 (Rewind) and 5 (The contradiction) are both CUT — Rewind
  // per product owner decision 2026-09-13 02:13 ET (reply 21837), the
  // contradiction per the reorder-to-13 pass (2026-09-13, Director
  // authorization). Old scenes 12 (Stress test) and 13 (The rules survive)
  // are ALSO cut as standalone scenes in that same pass (their headline
  // figure survives as a closing beat folded into scene 9 — see
  // StressResultFlash in CascadeFilm.tsx). All four scenes' cues are
  // retired with them rather than left dangling under numbers the new
  // 13-scene numbering reassigns to different scenes. Scene numbers below
  // are the NEW (post-reorder) numbering throughout this file.
  //
  // Scene 3 — The hidden supply chain (the example, renumbered from old
  // scene 4): "FROM APPLE · LATER" (at Samsung) / "PAYMENT NEEDED · TODAY"
  // (at Corning) globe labels land on the scene's last line — cue phrase
  // "obligation", falling back to "waits" for a re-narration that drops it
  // (see ExampleGlobeLabels in CascadeFilm.tsx).
  3: [
    {cue: 'example-labels', phrase: 'obligation'},
    {cue: 'example-labels-fallback', phrase: 'waits'},
  ],
  // Scene 4 — The question (renumbered from old scene 6): v9 narration
  // reads "Cascade gives that value a form that can move. A dated dollar.
  // Not as cash, as a dollar with a date." Three beats, each keyed to its
  // own spoken word: the card itself reveals on "form" (fallback "move"
  // for a re-narration that drops it), the headline on "dated" (fallback
  // "dollar"), and the secondary line on "cash".
  4: [
    {cue: 'question-card', phrase: 'form'},
    {cue: 'question-card-fallback', phrase: 'move'},
    {cue: 'dated-dollar', phrase: 'dated'},
    {cue: 'dated-dollar-fallback', phrase: 'dollar'},
    {cue: 'not-cash', phrase: 'cash'},
  ],
  // Scene 6 — Let it land (renumbered from old scene 8): v9 narration reads
  // "One hundred million dollars deposited. Four hundred fifty million
  // dollars transacted. Nine invoices settled. The payments add up. The
  // backing does not multiply. That's the cascade." Each counter and the
  // tagline now resolve against the actual recorded words, with a fallback
  // immediately after each primary for a future re-narration that drops it.
  6: [
    {cue: 'committed-counter', phrase: 'deposited'},
    {cue: 'committed-counter-fallback', phrase: 'hundred'},
    {cue: 'settled-counter', phrase: 'transacted'},
    {cue: 'settled-counter-fallback', phrase: 'fifty'},
    {cue: 'companies-counter', phrase: 'invoices'},
    {cue: 'companies-counter-fallback', phrase: 'Nine'},
    {cue: 'tagline', phrase: 'cascade'},
    {cue: 'tagline-fallback', phrase: 'backing'},
  ],
  // Scene 9 — Run the year (renumbered from old scene 9 — unchanged number,
  // but now plays AFTER scenes 7/8 instead of before): three rostrum-camera
  // moves on the capture layer (Liam round 2, msg 21778). Each primary
  // phrase is followed immediately by its fallback phrase so a future
  // re-narration that drops the primary word still resolves (cursor only
  // advances on a successful match, so the fallback search starts from the
  // same point the primary's would have). The scene's closing beat
  // (StressResultFlash) is not narration-keyed — see its own comment.
  9: [
    {cue: 'push-in-scrubber', phrase: 'simulation'},
    {cue: 'pan-to-ledger', phrase: 'invoices'},
    {cue: 'pan-to-ledger-fallback', phrase: 'Thousands'},
    {cue: 'pull-back-full', phrase: 'countries'},
    {cue: 'pull-back-full-fallback', phrase: 'across'},
  ],
  // Scene 7 — A dollar with a date (the primitive); same-date exchanges are scene-local.
  7: [
    {cue: 'same-date', phrase: 'Same date'},
    {cue: 'coin-extend', phrase: 'Extend'},
    {cue: 'coin-yield', phrase: 'yield'},
  ],
  // Scene 8 — Underneath it: the vault backing card's ERC-1155 line.
  8: [{cue: 'contract', phrase: 'The vault is an ERC-1155 contract'}],
  // Scene 10 — Zoom out (renumbered from old scene 14): the four word-chips, then "money plus time" (the
  // closing "a second dimension to money" card is not spoken — see file header).
  10: [
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
