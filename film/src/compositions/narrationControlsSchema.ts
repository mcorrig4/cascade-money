/**
 * Per-scene narration/audio controls, editable in Remotion Studio's props
 * sidebar via the `schema` passed to the CascadeFilm <Composition> in
 * Root.tsx. One entry per scene (1..17, same numbering as schedule.ts's
 * SCENES) so the product owner can nudge a single line's timing/level
 * without touching code:
 *
 *   offsetSec    — shifts the clip's start relative to the SCENE's own
 *                  start (not the film's). Negative means the clip is
 *                  already partway through by the time the scene begins
 *                  (an earlier start clipped by the cut into the scene);
 *                  positive delays the clip's start after the scene starts.
 *   trimStartSec — cuts this many seconds off the start of the raw clip.
 *   trimEndSec   — cuts this many seconds off the end of the raw clip.
 *   gainDb       — level adjustment in dB (0 = unity gain).
 *
 * All four default to 0, which is a no-op on every axis (no shift, no
 * trim, unity gain) — a film whose narrationControls are all at default
 * plays identically to a film with no narrationControls at all. This
 * MUST stay true: nothing in schedule.ts's or narration.ts's timing
 * defaults should ever need to change to keep this schema a no-op at
 * rest.
 */
import {z} from 'zod';

export const sceneNarrationControlSchema = z.object({
  scene: z.number().int().min(1).max(17),
  offsetSec: z.number().default(0),
  trimStartSec: z.number().min(0).default(0),
  trimEndSec: z.number().min(0).default(0),
  gainDb: z.number().default(0),
});

export type SceneNarrationControl = z.infer<typeof sceneNarrationControlSchema>;

/** Exactly 17 entries, one per scene — the Studio sidebar renders this as an editable array of scene objects. */
export const narrationControlsSchema = z.array(sceneNarrationControlSchema).length(17);

export type NarrationControls = z.infer<typeof narrationControlsSchema>;

export const DEFAULT_NARRATION_CONTROLS: NarrationControls = Array.from({length: 17}, (_, i) => ({
  scene: i + 1,
  offsetSec: 0,
  trimStartSec: 0,
  trimEndSec: 0,
  gainDb: 0,
}));

/** CascadeFilm's Remotion Studio-editable input props (see Root.tsx's <Composition schema={cascadeFilmSchema} />). */
export const cascadeFilmSchema = z.object({
  narrationControls: narrationControlsSchema,
});
