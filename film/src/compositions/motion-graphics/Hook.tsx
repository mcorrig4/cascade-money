/**
 * Scene 2 — The hook (product owner's brief 2026-09-13, round 3, msg 21865).
 * The old scene 2 ("Tim Apple walks offstage... teams building the next
 * one") is CUT. The capture (Apple Park orbit -> arch swoop -> pull-out to
 * Earth with the HUD) is KEPT — this component only adds the narration-beat
 * text and citation chips composited over it.
 *
 * v9 line, now Liam's real recorded take (film/public/narration/scene-02.wav,
 * words at cascade-narration/words-merged/scene-02.json):
 *   "You know what's crazy? Nearly two hundred billion dollars of product
 *   costs. Two hundred suppliers, thousands of factories, fifty countries.
 *   All of it running on payment terms and promises. Cascade Money settles
 *   those terms on Arc. Let me show you, with Apple."
 *
 * Text beats, each keyed to a cues.ts phrase (see cues.ts's scene-2 block),
 * with an even fixed-fraction fallback for the rare case a future
 * re-narration drops one of these words entirely:
 *   A "$200B of product costs"                    <- 'hook-open' ("crazy")
 *   B1 "200 suppliers"                             <- 'stat-suppliers'
 *   B2 "thousands of factories"                    <- 'stat-factories'
 *   B3 "50 countries"                              <- 'stat-countries'
 *   C "payment terms and promises"                 <- 'promises'
 *   D Cascade wordmark + "on Arc"                  <- 'wordmark' ("Cascade")
 *   E "Let me show you. Apple."                     <- 'apple-cta' ("Apple")
 * A and C occupy exclusive slots (fade+rise in, fade+rise out before the
 * next enters, per ConservationLaws' pattern); D and E are the closing pair
 * and simply hold once in (no exit — the scene ends on E).
 *
 * Round 5 (Liam, reply 21910, verbatim: "don't show all three facts in a
 * single reveal. They should appear as I say them, why would we combine?"):
 * B1/B2/B3 each reveal on their own word instead of one combined line —
 * they STACK (each earlier line stays on screen, dimmed once a later one
 * appears) until beat C takes over, at which point all three exit together.
 *
 * Citation chips (Liam's picture note: "show a little citations on screen
 * to show we are smart and looked up reports") key off the FIGURE cue, not
 * the beat's own entrance, and — once shown — stay up for the rest of the
 * scene rather than exiting with their beat (Liam: "appearing with their
 * figure and staying"). Wording is copied verbatim from
 * docs/cascade/hackathon/verified-figures-v6.md; nothing invented beyond it.
 *
 * Round 5 (Liam, reply 21910, verbatim: "same with staggering the
 * citations. Also citation should appear slightly faster the delay is too
 * long."): each chip fires CHIP_DELAY_SECONDS (now 150ms, down from 350ms)
 * after its own figure's cue — chip 1 -> 'stat-cost' ("billion"), chip 2 ->
 * 'stat-suppliers' ("suppliers"), chip 3 -> 'stat-factories' ("factories").
 * Chip 3 covers both the factories AND countries facts (same Supply Chain
 * Progress Report source) so it appears once, right after "factories",
 * rather than waiting for "countries". A chip can only appear at or after
 * its own figure's cue plus the delay — never earlier.
 *
 * Constraint (4): the wordmark beat (D) must never land before 10.5s of
 * FILM time (scene 2 starts ~9.3s in, right after scene 1) — `sceneStartFrame`
 * is this scene's own absolute start offset (already in the composition's
 * real fps), so the clamp works at any fps/profile.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {at30, CLAMP, enter} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {color, font, scrim} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';

const EXIT_DUR_AT_30 = 16;

/** Fade + rise-away exit — the mirror of `enter(..., 'rise')` (see ConservationLaws). */
const exitUp = (frame: number, at: number, dur: number) => {
  const p = interpolate(frame, [at, at + dur], [0, 1], CLAMP);
  return {opacity: 1 - p, transform: `translateY(${-24 * p}px)`};
};

/**
 * Drawn document glyph for the citation chips — no emoji, matches the
 * Wordmark's stroked-line style. Sized (and the chip text below) to stay
 * legible at the draft profile's 360p output (1/3 scale of the 1920x1080
 * canvas) — matching or exceeding ConservationLaws' 20px footer, the
 * smallest body text already shipped in this film.
 */
const DocGlyph: React.FC<{size?: number}> = ({size = 30}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M6 2.5h8l4 4v14.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
      stroke={color.money}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    <path d="M14 2.5V6a1 1 0 0 0 1 1h3.5" stroke={color.money} strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M7.5 12h9M7.5 15h9M7.5 18h6" stroke={color.money} strokeWidth={1.4} strokeLinecap="round" />
  </svg>
);

interface Citation {
  cue: string; // scene-2 cue name gating this chip's figure
  source: string;
  fact: string;
}

const CITATIONS: Citation[] = [
  {cue: 'stat-cost', source: 'Apple 10-K FY2025', fact: 'product cost of sales $194.1B'},
  {cue: 'stat-suppliers', source: 'Apple Supplier List 2025', fact: '~200 direct suppliers, 98% of spend'},
  // Keyed off 'stat-factories', not 'stat-countries' — this report covers
  // both facts, and round 5 (Liam, reply 21910) wants it appearing right
  // after "factories" rather than waiting for "countries".
  {cue: 'stat-factories', source: 'Apple Supply Chain 2025 Progress Report', fact: 'thousands of facilities, 50+ countries'},
];

/** Citation chips land 150ms after their own figure's cue, never before it (Liam round 5, reply 21910: "the delay is too long"). */
const CHIP_DELAY_SECONDS = 0.15;

const CitationChip: React.FC<{citation: Citation; appearAt: number}> = ({citation, appearAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = enter(frame, fps, appearAt, 'fade');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        opacity: e.opacity,
        maxWidth: 620,
        background: scrim,
        borderRadius: 10,
        padding: '10px 16px',
      }}
    >
      <div style={{marginTop: 2, flexShrink: 0}}>
        <DocGlyph />
      </div>
      <div style={{fontFamily: font.family, lineHeight: 1.4}}>
        <div style={{fontSize: 22, fontWeight: 600, color: color.fg, letterSpacing: 0.1}}>{citation.source}</div>
        <div style={{fontSize: 19, color: color.fgDim}}>{citation.fact}</div>
      </div>
    </div>
  );
};

/** Minimum FILM-time (seconds) the Cascade wordmark beat may land at — brief item (4). */
const WORDMARK_MIN_FILM_SECONDS = 10.5;

export const Hook: React.FC<{
  durationInFrames: number;
  cues?: SceneCues;
  /** This scene's own absolute start offset (frames, real composition fps) — for the wordmark's film-time clamp. */
  sceneStartFrame: number;
}> = ({durationInFrames: dur, cues, sceneStartFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const exitDur = at30(EXIT_DUR_AT_30, fps);

  // A/B/C/D/E fixed-fraction fallback slots — used only if a future
  // re-narration drops one of these cue phrases entirely (see file header).
  const slot = dur / 5;
  const fallbackA = 0;
  const fallbackB = slot;
  const fallbackC = slot * 2;
  const fallbackD = slot * 3;
  const fallbackE = slot * 4;

  const startA = cueFrame(cues, 'hook-open', fps, fallbackA);
  // B1/B2/B3 — the three facts, each on its own word (round 5, reply
  // 21910: "why would we combine?"), fanned out across beat B's old slot
  // as a fixed-fraction fallback.
  const startB1 = cueFrame(cues, 'stat-suppliers', fps, fallbackB);
  const startB2 = cueFrame(cues, 'stat-factories', fps, fallbackB + slot * 0.33);
  const startB3 = cueFrame(cues, 'stat-countries', fps, fallbackB + slot * 0.66);
  const startC = cueFrame(cues, 'promises', fps, fallbackC);
  let startD = cueFrame(cues, 'wordmark', fps, fallbackD);
  const startE = cueFrame(cues, 'apple-cta', fps, fallbackE);

  // (4) The wordmark must never land before 10.5s of FILM time.
  const minWordmarkFilmFrame = Math.round(WORDMARK_MIN_FILM_SECONDS * fps);
  const minWordmarkLocalFrame = Math.max(0, minWordmarkFilmFrame - sceneStartFrame);
  startD = Math.max(startD, minWordmarkLocalFrame);

  const exitAAt = Math.max(startA, startB1 - exitDur);
  // The B group (B1/B2/B3) exits together, right before beat C — never
  // before the last of the three (B3) has actually appeared.
  const exitBAt = Math.max(startB3, startC - exitDur);
  const exitCAt = Math.max(startC, startD - exitDur);

  const beatA = frame < exitAAt ? enter(frame, fps, startA, 'rise') : exitUp(frame, exitAAt, exitDur);
  const beatB1 = frame < exitBAt ? enter(frame, fps, startB1, 'rise') : exitUp(frame, exitBAt, exitDur);
  const beatB2 = frame < exitBAt ? enter(frame, fps, startB2, 'rise') : exitUp(frame, exitBAt, exitDur);
  const beatB3 = frame < exitBAt ? enter(frame, fps, startB3, 'rise') : exitUp(frame, exitBAt, exitDur);
  const beatC = frame < exitCAt ? enter(frame, fps, startC, 'rise') : exitUp(frame, exitCAt, exitDur);
  const beatD = enter(frame, fps, startD, 'settle'); // holds — D/E are the closing pair, no exit
  const beatE = enter(frame, fps, startE, 'settle');

  const showA = frame >= startA && frame < Math.min(startB1, exitAAt + exitDur);
  const bGroupEnd = Math.min(startC, exitBAt + exitDur);
  const showB1 = frame >= startB1 && frame < bGroupEnd;
  const showB2 = frame >= startB2 && frame < bGroupEnd;
  const showB3 = frame >= startB3 && frame < bGroupEnd;
  const showB = showB1 || showB2 || showB3;
  const showC = frame >= startC && frame < Math.min(startD, exitCAt + exitDur);
  const showD = frame >= startD && frame < startE;
  const showE = frame >= startE;

  // Once the group starts exiting, all three fade+rise out together (no
  // more dimming distinction). Before that, only the LATEST-appeared line
  // is at full opacity — earlier lines dim slightly, per Liam's "stack,
  // previous stays, dimmed" direction.
  const bExiting = frame >= exitBAt;
  const DIM = 0.55;
  const b1Latest = !showB2 && !showB3;
  const b2Latest = showB2 && !showB3;
  const dimStyle = (beat: {opacity: number; transform: string}, isLatest: boolean) => ({
    opacity: beat.opacity * (bExiting || isLatest ? 1 : DIM),
    transform: beat.transform,
  });

  // Citation chip appearance frames — figure-keyed, not beat-keyed, and each
  // stays up once shown (no exit) for the rest of the scene. Each chip fires
  // CHIP_DELAY_SECONDS (150ms, round 5) AFTER its own figure's cue (never
  // before it's spoken). 'stat-factories' chains a 'stat-countries' fallback
  // the same way CascadeFilm's scene 9 chains primary/fallback narration
  // cues, in case a re-narration drops "factories" but keeps "countries".
  const chipDelayFrames = Math.round(CHIP_DELAY_SECONDS * fps);
  const chipCueFrame = (cue: string, staticFallback: number): number =>
    cue === 'stat-factories'
      ? cueFrame(cues, 'stat-factories', fps, cueFrame(cues, 'stat-countries', fps, staticFallback))
      : cueFrame(cues, cue, fps, staticFallback);
  const chipStaticFallbacks: Record<string, number> = {
    'stat-cost': fallbackA + slot * 0.55,
    'stat-suppliers': fallbackB + slot * 0.4,
    'stat-factories': fallbackB + slot * 0.7,
  };
  const chipStarts = CITATIONS.map(
    (c) => chipCueFrame(c.cue, chipStaticFallbacks[c.cue] ?? fallbackB + slot * 0.4) + chipDelayFrames,
  );

  return (
    <AbsoluteFill style={{fontFamily: font.family}}>
      {/* Text beats get a soft scrim so they read over the moving capture without hiding it entirely. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${scrim} 38%, ${scrim} 62%, transparent 100%)`,
          opacity: showA || showB || showC || showD || showE ? 1 : 0,
        }}
      />

      <AbsoluteFill style={{display: 'grid', placeItems: 'center'}}>
        {showA && (
          <div
            style={{
              opacity: beatA.opacity,
              transform: beatA.transform,
              textAlign: 'center',
              color: color.fg,
              fontSize: 64,
              fontWeight: 550,
              letterSpacing: -1.2,
            }}
          >
            $200B of product costs
          </div>
        )}

        {showB && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center'}}>
            {showB1 && (
              <div
                style={{
                  ...dimStyle(beatB1, b1Latest),
                  textAlign: 'center',
                  color: color.fg,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: -0.4,
                  lineHeight: 1.3,
                }}
              >
                200 suppliers
              </div>
            )}
            {showB2 && (
              <div
                style={{
                  ...dimStyle(beatB2, b2Latest),
                  textAlign: 'center',
                  color: color.fg,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: -0.4,
                  lineHeight: 1.3,
                }}
              >
                thousands of factories
              </div>
            )}
            {showB3 && (
              <div
                style={{
                  ...dimStyle(beatB3, true),
                  textAlign: 'center',
                  color: color.fg,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: -0.4,
                  lineHeight: 1.3,
                }}
              >
                50 countries
              </div>
            )}
          </div>
        )}

        {showC && (
          <div
            style={{
              opacity: beatC.opacity,
              transform: beatC.transform,
              textAlign: 'center',
              color: color.amber,
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: -0.6,
            }}
          >
            payment terms and promises
          </div>
        )}

        {showD && (
          <div style={{textAlign: 'center', opacity: beatD.opacity, transform: beatD.transform}}>
            <div style={{display: 'flex', justifyContent: 'center'}}>
              <Wordmark size={72} full />
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 24,
                color: color.fgDim,
                letterSpacing: 0.2,
              }}
            >
              on Arc
            </div>
          </div>
        )}

        {showE && (
          <div
            style={{
              opacity: beatE.opacity,
              transform: beatE.transform,
              textAlign: 'center',
              color: color.fg,
              fontSize: 56,
              fontWeight: 550,
              letterSpacing: -1,
            }}
          >
            Let me show you. Apple.
          </div>
        )}
      </AbsoluteFill>

      <AbsoluteFill style={{display: 'grid', placeItems: 'end start', padding: '0 0 48px 48px'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          {CITATIONS.map((c, i) => (
            <CitationChip key={`${c.cue}-${c.source}`} citation={c} appearAt={chipStarts[i]} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
