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
 *   - Scene 9's closing StressResultFlash is now keyed (`stress-flash` on
 *     "Separately", fallback "tested" — reorder-to-13 pass's headline
 *     figure, resolved against the real recorded words below). Scene 12's
 *     close card (Scene17Close, old 17) is NOT keyed to its cue on
 *     purpose: its three beats (tagline -> wordmark -> "Dated dollars on
 *     Arc.") are a deliberate held dramatic sequence timed off the
 *     scene's own duration; the actual VO is now four words ("This is
 *     Cascade Money.") spoken almost entirely in the first second, so
 *     anchoring the wordmark to the word "Cascade" would collapse the
 *     sequence instead of pacing it. Its cue is still authored below
 *     (resolves cleanly) so that pacing decision can be revisited without
 *     a re-transcription.
 *
 * Cue remap for the final 12-scene film (Director, 2026-09-13, re-run
 * against the re-transcribed installed wavs for scenes 7-12 — see
 * dev-mac ~/cascade-narration/words-merged/scene-0{7..9}.json,
 * scene-1{0,1,2}.json):
 *   - Scene 7 (the primitive): three beats keyed to the recorded take —
 *     `swap` on "interchangeable", `earlier-pays-later` on "face" ("A
 *     dollar due earlier pays a bill due later at face value"), `extend`
 *     on "push" ("If you push the date out, you earn the yield..."), and
 *     a `final-card` on the Kokoro tail's "One dollar" ("One dollar. One
 *     date.", scene-07-kokoro-tail.wav, which plays after the main clip —
 *     see narration.ts's tailFile/tailOffsetInFrames). That tail's words
 *     are merged into words-merged/scene-07.json at the main clip's raw
 *     length + its narration.json tailGapSec (0.85s -> 28.74s) so
 *     cues-from-words.mjs (which reads one words file per scene) can
 *     resolve it — same idea as scene 1's
 *     tail, which doesn't need this because its own cue phrase
 *     ("foldable") already lives in the main clip. The end-of-scene "A
 *     vault on Arc" card (app's ShotOverlays.tsx 'backing' overlay) is
 *     REMOVED from scene 7 — the vault is scene 8 now (Director, 04:34
 *     ET) — scene 7 defines no cue for it, and never did on the film
 *     side; that card's own timing is app-side (stage 17/18), not driven
 *     by this file.
 *   - Scene 8 (Underneath it): the vault backing card's cues split into
 *     `contract` on "ERC" (fallback "1155", the number half of
 *     "ERC-1155" for a re-narration that drops the letters) and `reserve`
 *     on "USYC".
 *   - Scene 9 (Run the year): the existing rostrum-camera cues are
 *     unchanged; `stress-flash` on "Separately" (fallback "tested") and
 *     `ui-origin` on "interface" are added for the closing two lines
 *     ("Separately, we tested ten thousand operations..." / "That's
 *     where this user interface came from...").
 *   - Scene 10 (Zoom out): word-chip cues unchanged; added `wordmark` on
 *     the Kokoro-voiced "Cascade" ("Cascade makes that date part of the
 *     money itself").
 *   - Scene 11 (Beneath it): `promises` on the first "promises" ("an
 *     invisible chain of promises") and `cascade-would` on "Cascade"
 *     ("Cascade would have let those promises move before the cash
 *     does.").
 *   - Scene 12 (Close): `wordmark` on "Cascade" — authored per the note
 *     above; not wired into Scene17Close's rendering.
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
  //
  // Scene 3's bake-off pass (Director, 2026-09-13) drives the WHOLE scene from
  // these phrases: the app's shot 3 resolves each one through
  // PlaybackEngine.atWord (see app/src/director/shots.ts), and the obligation
  // card reads the last four. Resolved against the recorded v9 take
  // (scene-03.wav, 33.15s) — the order-sensitive walk is what separates the
  // two spoken "orders" ("Apple orders ..." at 2.36s, "Samsung orders ..." at
  // 7.94s) and the two spoken "today"s.
  3: [
    // The three order cues keep the app's own names (shots.ts orderCues /
    // company-cues.ts, which also draws the company callout off `word`):
    // "Samsung" is the beat where Apple's order to Samsung Display fires, not
    // the word "Samsung" — the arc has to leave Cupertino as he STARTS the
    // sentence, and the camera follows it, so it keys to "orders".
    {cue: 'Samsung', phrase: 'orders'},
    {cue: 'Corning', phrase: 'Samsung orders'},
    {cue: 'Sony', phrase: 'Sony'},
    {cue: 'chain-fanout', phrase: 'Everyone'},
    {cue: 'parts-move', phrase: 'parts'},
    {cue: 'money-waits', phrase: 'waits'},
    {cue: 'display-maker', phrase: 'display'},
    {cue: 'owes-glass', phrase: 'owes'},
    // "The glass maker HAS suppliers" — the four-word phrase is what skips the
    // identical "the glass maker" two seconds earlier, at the end of the
    // previous line.
    {cue: 'glass-maker', phrase: 'the glass maker has'},
    {cue: 'pay-today', phrase: 'suppliers'},
    {cue: 'incoming-value', phrase: 'incoming'},
    {cue: 'obligation', phrase: 'obligation'},
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
    // Closing two lines (Director, 2026-09-13): the stress-test result flash
    // now keys to "Separately" (falling back to "tested" immediately after
    // it), and an optional "built to visualize the stress simulations"
    // card keys to "interface" ("That's where this user interface came
    // from...").
    {cue: 'stress-flash', phrase: 'Separately'},
    {cue: 'stress-flash-fallback', phrase: 'tested'},
    {cue: 'ui-origin', phrase: 'interface'},
  ],
  // Scene 7 — A dollar with a date (the primitive). Recorded take (Director,
  // 2026-09-13 04:34 ET): "swap" fires on "interchangeable", the
  // earlier-pays-later beat on "face" ("a bill due later at face value"),
  // the extend beat on "push" ("if you push the date out, you earn the
  // yield"), and the final card on the Kokoro tail's "One dollar" ("One
  // dollar. One date.") — see file header for the tail-merge mechanism.
  // The end-of-scene "A vault on Arc" card is REMOVED (moved to scene 8);
  // no cue for it is defined here.
  7: [
    {cue: 'swap', phrase: 'interchangeable'},
    {cue: 'earlier-pays-later', phrase: 'face'},
    {cue: 'extend', phrase: 'push'},
    {cue: 'final-card', phrase: 'One dollar'},
  ],
  // Scene 8 — Underneath it: the vault backing card's cues, split per the
  // real recorded words — contract → "ERC" (fallback "1155"), reserve →
  // "USYC" (the vault's designed yield reserve).
  8: [
    {cue: 'contract', phrase: 'ERC'},
    {cue: 'contract-fallback', phrase: '1155'},
    {cue: 'reserve', phrase: 'USYC'},
  ],
  // Scene 10 — Zoom out (renumbered from old scene 14): the four word-chips,
  // a wordmark beat on the Kokoro-voiced "Cascade", then "money plus time"
  // (the closing "a second dimension to money" card is not spoken — see
  // file header).
  10: [
    {cue: 'word-loans', phrase: 'Loans'},
    {cue: 'word-forwards', phrase: 'forwards'},
    {cue: 'word-bonds', phrase: 'bonds'},
    {cue: 'word-derivatives', phrase: 'derivatives'},
    {cue: 'wordmark', phrase: 'Cascade'},
    {cue: 'money-plus-time', phrase: 'money plus time'},
    {cue: 'final-line', phrase: 'a second dimension to money'},
  ],
  // Scene 11 — Beneath it: "Behind this new folding iPhone was an
  // invisible chain of promises. Cascade would have let those promises
  // move before the cash does." No film-side overlay exists yet for this
  // scene — authored against the real words for whenever one lands.
  11: [
    {cue: 'promises', phrase: 'promises'},
    {cue: 'cascade-would', phrase: 'Cascade'},
  ],
  // Scene 12 — Close: narration is "This is Cascade Money." (2.7s).
  // Authored per the file header note above — resolves, but Scene17Close
  // does not read it (deliberate pacing decision, unchanged by this pass).
  12: [{cue: 'wordmark', phrase: 'Cascade'}],
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
