/**
 * Scene 2 — The hook (product owner's brief 2026-09-13 02:05 ET, round 2).
 * The old scene 2 ("Tim Apple walks offstage... teams building the next
 * one") is CUT. The capture (Apple Park orbit -> arch swoop -> pull-out to
 * Earth with the HUD) is KEPT — this component only adds the narration-beat
 * text and citation chips composited over it.
 *
 * New v9 line (Liam will record it; v7 placeholder plays until then):
 *   "You know what's crazy? Nearly two hundred billion dollars of product
 *   costs. Two hundred suppliers, thousands of factories, fifty countries.
 *   All of it running on payment terms and promises. Cascade Money settles
 *   those terms on Arc. Let me show you, with Apple."
 *
 * Five exclusive text beats (A-E), each keyed to a cues.ts phrase (see
 * cues.ts's scene-2 block) with an even fixed-fraction fallback for as long
 * as the v7 placeholder audio is still playing here (it speaks different
 * words entirely, so these mostly won't resolve — same documented case as
 * scenes 8/14's never-spoken cues):
 *   A "$200B of product costs"                    <- 'hook-open' ("crazy")
 *   B "200 suppliers · thousands of factories ·
 *      50 countries"                               <- 'stat-suppliers'
 *   C "payment terms and promises"                 <- 'promises'
 *   D Cascade wordmark + "on Arc"                  <- 'wordmark' ("Cascade")
 *   E "Let me show you. Apple."                     <- 'apple-cta' ("Apple")
 * A, B and C occupy exclusive slots (fade+rise in, fade+rise out before the
 * next enters, per ConservationLaws' pattern); D and E are the closing pair
 * and simply hold once in (no exit — the scene ends on E).
 *
 * Citation chips (Liam's picture note: "show a little citations on screen
 * to show we are smart and looked up reports") key off the FIGURE cue, not
 * the beat's own entrance, and — once shown — stay up for the rest of the
 * scene rather than exiting with their beat (Liam: "appearing with their
 * figure and staying"). Wording is copied verbatim from
 * docs/cascade/hackathon/verified-figures-v6.md; nothing invented beyond it.
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
  {cue: 'stat-suppliers', source: 'Apple Supply Chain 2025 Progress Report', fact: 'thousands of facilities, 50+ countries'},
];

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

  // A/B/C/D/E fixed-fraction fallback slots — a sensible even spread across
  // the scene for as long as the placeholder v7 audio leaves these cues
  // unresolved (see file header).
  const slot = dur / 5;
  const fallbackA = 0;
  const fallbackB = slot;
  const fallbackC = slot * 2;
  const fallbackD = slot * 3;
  const fallbackE = slot * 4;

  const startA = cueFrame(cues, 'hook-open', fps, fallbackA);
  const startB = cueFrame(cues, 'stat-suppliers', fps, fallbackB);
  const startC = cueFrame(cues, 'promises', fps, fallbackC);
  let startD = cueFrame(cues, 'wordmark', fps, fallbackD);
  const startE = cueFrame(cues, 'apple-cta', fps, fallbackE);

  // (4) The wordmark must never land before 10.5s of FILM time.
  const minWordmarkFilmFrame = Math.round(WORDMARK_MIN_FILM_SECONDS * fps);
  const minWordmarkLocalFrame = Math.max(0, minWordmarkFilmFrame - sceneStartFrame);
  startD = Math.max(startD, minWordmarkLocalFrame);

  const exitAAt = Math.max(startA, startB - exitDur);
  const exitBAt = Math.max(startB, startC - exitDur);
  const exitCAt = Math.max(startC, startD - exitDur);

  const beatA = frame < exitAAt ? enter(frame, fps, startA, 'rise') : exitUp(frame, exitAAt, exitDur);
  const beatB = frame < exitBAt ? enter(frame, fps, startB, 'rise') : exitUp(frame, exitBAt, exitDur);
  const beatC = frame < exitCAt ? enter(frame, fps, startC, 'rise') : exitUp(frame, exitCAt, exitDur);
  const beatD = enter(frame, fps, startD, 'settle'); // holds — D/E are the closing pair, no exit
  const beatE = enter(frame, fps, startE, 'settle');

  const showA = frame >= startA && frame < Math.min(startB, exitAAt + exitDur);
  const showB = frame >= startB && frame < Math.min(startC, exitBAt + exitDur);
  const showC = frame >= startC && frame < Math.min(startD, exitCAt + exitDur);
  const showD = frame >= startD && frame < startE;
  const showE = frame >= startE;

  // Citation chip appearance frames — figure-keyed, not beat-keyed, and each
  // stays up once shown (no exit) for the rest of the scene.
  const chipStarts = CITATIONS.map((c) => cueFrame(cues, c.cue, fps, c.cue === 'stat-cost' ? fallbackA + slot * 0.55 : fallbackB + slot * 0.4));

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
          <div
            style={{
              opacity: beatB.opacity,
              transform: beatB.transform,
              textAlign: 'center',
              color: color.fg,
              fontSize: 44,
              fontWeight: 500,
              letterSpacing: -0.4,
              lineHeight: 1.3,
            }}
          >
            200 suppliers · thousands of factories · 50 countries
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
