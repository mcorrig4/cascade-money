# W0: app-style surface and window geometry

Implemented against `origin/main` at `5de49fa24665a0d162ed0b66913a594181d3979f`.
No scene content, capture, narration, cue, schedule, or app source is changed.
No video renderer, browser, or server was used for validation on this host.
The state-preservation test uses React’s Node-only test reconciler.

## Window API

```tsx
<WindowLayout preset="skewRight">{capture}</WindowLayout>

const spec = {
  from: 'skewRight', to: 'centerLarge',
  startFrame: cueFrame(cues, 'contract', fps, fallbackFrame),
  durationInFrames: Math.round(0.9 * fps),
} as const;
const geometry = useWindowGeometry(spec);
return <>
  <WindowLayout {...spec}>{capture}</WindowLayout>
  <AppSurface ledgerSidebar>
    <PresentationPane side="left" geometry={geometry}>
      <section className="overlay-card backing-card">{content}</section>
    </PresentationPane>
  </AppSurface>
```

Use the same transition specification and Sequence time for the window and pane.
Do not wrap WindowLayout in AppSurface: the surface is for film-drawn cards.
WindowLayout adds no DOM around BrowserFrame. All five named layouts live in
`src/components/windowGeometry.ts`, re-exported by `WindowLayout.tsx`.

`centerLarge` includes browser chrome within its 2.5% outer margins: a
1824×1026 window at (48,27) in the 1920×1080 composition. `fullscreen` has no
chrome, rounded clip, border or content inset. Existing BrowserFrame callers
retain their original defaults, including the older simple-chrome/tilt modes.

Transitions clamp and use `Easing.inOut(Easing.cubic)` by default. `easing` is
an optional override. Resolved `WindowState`/`WindowGeometry` endpoints allow
composition of motions without applying easing twice. Durations must be positive.
The preset table and each preset are frozen. All geometry fields and frame inputs
must be finite; scale, perspective and composition dimensions must be positive;
chrome progress and transform-origin fractions must lie in [0,1]. Off-screen
anchors and scales greater than one are allowed. Camera-plane crossings fail.
WindowLayout keeps the browser tree mounted even at zero chrome: fullscreen
changes appearance, not the child ancestry. Legacy BrowserFrame callers retain
their original mode-specific trees.

### Projection and mirror

`geometry.corners` are the four projected border-box corners, clockwise from
top-left. `geometry.rect` is their exact axis-aligned bounding rectangle, in
composition pixels, not an approximation of the unrotated box. It excludes
blurred shadows; PresentationPane's padding separates text from the frame.
Rounded corners lie inside these border-box bounds, so the rectangle is safe.

The calculation follows BrowserFrame's CSS transform order:
`translateY(-50%) scale(s) rotateY(theta)`, about the interpolated transform
origin. With `dx = cornerX - originX`, the rotated depth is
`z = -sin(theta) * dx`; **scale(s) changes X and Y, but not Z**. Parent perspective
is centred at `(width/2,height/2)`, with factor `perspective/(perspective-z)`.
This also handles a near edge projecting beyond the unrotated bounds. With the
specific left-origin +8° preset the far edge recedes; the right-origin -8° preset
is its exact horizontal mirror. Flipping just the angle would not suffice.

`anchorLeftFrac` describes the unrotated visible left edge. The actual CSS `left`
compensates for the origin: `anchorLeftFrac - (1-scale)*originXFrac`. For scene 1's
left origin, the original multiplication order is retained for strict equality.

PresentationPane uses those current projected bounds and a default 32-design-pixel
padding. It centres vertically by default (`verticalAlign` can be `start`/`end`).
When space disappears the pane collapses. It clips oversized cards so they cannot
cross the window. `contain: layout paint` establishes the fixed-position
containing block and clips descendant painting to the pane, including fixed
app cards. AppSurface itself remains unclipped. Arbitrarily wide cards
may require scene-authored reflow; the pane does not shrink the app's typography.

### Scene 1 compatibility

The entrance is `fullscreen` toward the current `skewLeft` → `centerSmall` swing
endpoint. Entrance timing remains cubic ease-out over `at30(36,fps)` frames.
The swing remains cubic ease-in-out over `at30(27,fps)` frames, ending at `D-1`.
Composed endpoints preserve the original product of progress values even if a
short scene makes the two spans overlap. Phone timing/fade and its settled,
unrotated right-edge anchor are unchanged.

`legacyFrameAppearance` is explicitly enabled for scene 1: the original p=0
browser surface still had an 8px radius and transparent 1px border. It therefore
was not genuine full bleed. Keeping those edges is required for pixel parity;
ordinary fullscreen does not inherit that exception.

Independent baseline expressions, with entrance progress p and swing progress s:

```text
scale       = 1 - (1 - 0.62) * p
leftPct     = (0.04 + ((1 - 0.62) / 2 - 0.04) * s) * p * 100
rotateY     = (8 + (0 - 8) * s) * p
perspective = 1800
radius      = 8 + 14 * p
border      = 1px solid rgba(170,199,204,0.22 * p)
shadow      = 0 (60*p)px (140*p)px rgba(0,0,0,0.55*p)
contentTop  = 65 * p
```

## AppSurface containment

Imports are `@cascade-app/styles.css?app-surface`, then `stage.css?app-surface`,
then `film.css?app-surface`, followed by `AppSurface.css`. The query selects the
film's webpack pre-loader, before the normal css-loader/style-loader pipeline.
There is no app JS/TSX import. Callers may explicitly import small app leaf
components. Inter uses the film's existing awaited FontFace loader.

A final global reset cannot undo arbitrary `.overlay-card`, `button`, or
`.eyebrow` rules safely: it does not know each film element's prior values. The
bridge instead contains **every** app selector (even already `.app`-scoped ones)
by appending a zero-specificity subject guard:

```css
.overlay-card:where(.film-app-surface, .film-app-surface *) { /* original declarations */ }
.app .cascade-stat strong:where(.film-app-surface, .film-app-surface *) { /* original declarations */ }
```

The guard is inserted before pseudo-elements. It retains original card selector
specificity and supports `.app`, `.recording-hud`, `.overlay-active` and other
state classes on the surface itself. A plain ancestor prefix would break that
case. `:root`, `html`, `body`, and `#root` references become `.film-app-surface`;
custom properties therefore survive through local inheritance. Media conditions
are preserved. The final surface stylesheet plus explicit inline dimensions
remove document positioning/ground/clipping from this local root only, and disable
pointer events and wall-clock CSS animations/transitions on descendants.

This does not inject a new global document reset or change the film's ground,
body metrics, or non-surface elements. The scoped import path is independent of
the raw imports already used by the existing live app.

### Film unit and validation limits

The installed Remotion **4.0.484** renderer's `dist/make-page.js` and
`dist/render-still.js` set `width: composition.width`, `height: composition.height`,
and `deviceScaleFactor: scale` on the page. A 1/3-scale render still has a
1920×1080 CSS viewport. No running-browser observation was used or claimed.

AppSurface pins `--film-unit` to the exact stylesheet conversion:
`min(0.0520833333*width/100, 0.0925925926*height/100)` CSS pixels, using
`useVideoConfig()`. At 1920×1080 this is `0.99999999936px`, nominally 1px.
Output render scale is not multiplied in again. Tests derive expected values
from the actual app stylesheet, not a second hand-copied font token table.
The totals numbers are nominally 120px, captions 44px, and card headings 84px.
This is the permitted **unit-test acceptance alternative**, not a claim that
browser-computed font sizes or glyph rasterization were measured on this box.

The landscape `@media (min-aspect-ratio:4/3)` gate still depends on the viewport.
Every film composition/render here is landscape. Pinning the unit alone cannot
activate those rules in a portrait Studio browser viewport. Arbitrary portrait
presentation support is not part of this 1920×1080 foundation.

### Containment policies

| Policy | Implementation / reason |
| --- | --- |
| `scoped-subject` | Preserve declarations and conditions; append the subject guard before any pseudo-element. Nothing outside AppSurface can match. Includes universal, element, class, pseudo-class and pseudo-element selectors. |
| `local-document` | Map document/root selectors to the surface, then guard them. App custom properties and typography inherit locally. AppSurface.css and inline surface styles override local ground, positioning, margins, minimum height and clipping. |
| `scoped-conditional` | Preserve `@media` (and supported future `@supports`) conditions; recursively scope every nested style rule. Conditions themselves cannot style an element. |
| `namespaced-keyframes` | Prefix definitions and animation references with `cascade-surface-`; frame-driven surface CSS also disables their playback. They cannot collide with existing film animation names. |
| `film-inter` | Omit app's `@font-face Inter {src:local('Inter')}`. Reuse film's awaited Inter faces instead of registering a competing local face. |
| `coin-font` | Retain the uniquely named `Coin Date Condensed` face and identical RobotoCondensed-Light asset. It is not a generic family alias and cannot affect elements that do not explicitly request this coin font. Existing live-app registration is the same family/source. |

The following is the **complete enumeration**, including media ancestry, of
all selectors (including `.app` selectors and sibling targets) and every at-rule in the three app stylesheets.
Duplicate selectors within the same file/conditional context share a row.
Keyframe step selectors (`from`, `to`, percentages) are covered by the enclosing
namespaced-keyframes row; they are not document selectors.

The reviewed source of this table is
`src/components/app-surface-containment.json`. `AppSurface.css` cites that file.
Tests parse all three actual app sheets and require an exact inventory match,
including font-face family names and keyframe names. Tests also check this table
against the reviewed inventory. **Do not auto-refresh the inventory to silence a
failure**: review the new rule's containment first, then update both list and table.
An added selector, breakpoint, font face, or keyframe requires review.

<!-- containment-table:start -->
| File | Conditional context | Selector / at-rule | Containment |
| --- | --- | --- | --- |
| `styles.css` | `(all)` | `:root` | `local-document` |
| `styles.css` | `(all)` | `*` | `scoped-subject` |
| `styles.css` | `(all)` | `body` | `local-document` |
| `styles.css` | `(all)` | `button` | `scoped-subject` |
| `styles.css` | `(all)` | `a` | `scoped-subject` |
| `styles.css` | `(all)` | `input` | `scoped-subject` |
| `styles.css` | `(all)` | `button:disabled` | `scoped-subject` |
| `styles.css` | `(all)` | `button:focus-visible` | `scoped-subject` |
| `styles.css` | `(all)` | `a:focus-visible` | `scoped-subject` |
| `styles.css` | `(all)` | `input:focus-visible` | `scoped-subject` |
| `styles.css` | `(all)` | `button:hover:not(:disabled)` | `scoped-subject` |
| `styles.css` | `(all)` | `.app` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-scene` | `scoped-subject` |
| `styles.css` | `(all)` | `.site-scene` | `scoped-subject` |
| `styles.css` | `(all)` | `.amount-layer` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-scene canvas` | `scoped-subject` |
| `styles.css` | `(all)` | `.site-scene canvas` | `scoped-subject` |
| `styles.css` | `(all)` | `.site-attribution` | `scoped-subject` |
| `styles.css` | `(all)` | `.site-attribution[hidden]` | `scoped-subject` |
| `styles.css` | `(all)` | `.site-google-logo` | `scoped-subject` |
| `styles.css` | `(all)` | `.site-google-credits` | `scoped-subject` |
| `styles.css` | `(all)` | `.topbar` | `scoped-subject` |
| `styles.css` | `(all)` | `.brand` | `scoped-subject` |
| `styles.css` | `(all)` | `.brand svg` | `scoped-subject` |
| `styles.css` | `(all)` | `.brand-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.brand-subtitle` | `scoped-subject` |
| `styles.css` | `(all)` | `.story-selector` | `scoped-subject` |
| `styles.css` | `(all)` | `.story-selector button` | `scoped-subject` |
| `styles.css` | `(all)` | `.story-selector button[aria-pressed=true]` | `scoped-subject` |
| `styles.css` | `(all)` | `.network-status` | `scoped-subject` |
| `styles.css` | `(all)` | `.status-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.eyebrow` | `scoped-subject` |
| `styles.css` | `(all)` | `.scene-heading` | `scoped-subject` |
| `styles.css` | `(all)` | `.scene-heading h1` | `scoped-subject` |
| `styles.css` | `(all)` | `.scene-heading p` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-coordinate` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-coordinate span:first-child` | `scoped-subject` |
| `styles.css` | `(all)` | `.app .location-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .cube-caption` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.app .location-card` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.clean-frame .cube-caption` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-heading` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-heading h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.count` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-columns` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-scroll` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-row` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-row-top` | `scoped-subject` |
| `styles.css` | `(all)` | `.operation-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.invoice_registered .operation-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.extend .operation-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.operation_rejected .operation-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.sequence` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-parties` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-parties>span:not(.arrow)` | `scoped-subject` |
| `styles.css` | `(all)` | `.arrow` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-bottom` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-bottom strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.invoice_registered .ledger-bottom strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-bottom>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-annotation` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-foot` | `scoped-subject` |
| `styles.css` | `(all)` | `.ledger-empty` | `scoped-subject` |
| `styles.css` | `(all)` | `.empty-line` | `scoped-subject` |
| `styles.css` | `(all)` | `.bottom-panel` | `scoped-subject` |
| `styles.css` | `(all)` | `.timeline-region` | `scoped-subject` |
| `styles.css` | `(all)` | `.timeline-top` | `scoped-subject` |
| `styles.css` | `(all)` | `.date-block` | `scoped-subject` |
| `styles.css` | `(all)` | `.date-block strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.series-key` | `scoped-subject` |
| `styles.css` | `(all)` | `.series-key span` | `scoped-subject` |
| `styles.css` | `(all)` | `.series-key i` | `scoped-subject` |
| `styles.css` | `(all)` | `.key-purchases` | `scoped-subject` |
| `styles.css` | `(all)` | `.key-settled` | `scoped-subject` |
| `styles.css` | `(all)` | `.chart-track` | `scoped-subject` |
| `styles.css` | `(all)` | `.volume-chart` | `scoped-subject` |
| `styles.css` | `(all)` | `.volume-chart svg` | `scoped-subject` |
| `styles.css` | `(all)` | `.chart-ceiling` | `scoped-subject` |
| `styles.css` | `(all)` | `.scrubber` | `scoped-subject` |
| `styles.css` | `(all)` | `.scrubber::-webkit-slider-runnable-track` | `scoped-subject` |
| `styles.css` | `(all)` | `.scrubber::-webkit-slider-thumb` | `scoped-subject` |
| `styles.css` | `(all)` | `.scrubber::-moz-range-thumb` | `scoped-subject` |
| `styles.css` | `(all)` | `.timeline-months` | `scoped-subject` |
| `styles.css` | `(all)` | `.transport` | `scoped-subject` |
| `styles.css` | `(all)` | `.play-button` | `scoped-subject` |
| `styles.css` | `(all)` | `.play-button:hover:not(:disabled)` | `scoped-subject` |
| `styles.css` | `(all)` | `.icon-button` | `scoped-subject` |
| `styles.css` | `(all)` | `.speed-options` | `scoped-subject` |
| `styles.css` | `(all)` | `.speed-options button` | `scoped-subject` |
| `styles.css` | `(all)` | `.speed-options button[aria-pressed=true]` | `scoped-subject` |
| `styles.css` | `(all)` | `.speed-options button:last-child` | `scoped-subject` |
| `styles.css` | `(all)` | `.playback-state` | `scoped-subject` |
| `styles.css` | `(all)` | `.headline-counters` | `scoped-subject` |
| `styles.css` | `(all)` | `.headline>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.headline>strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.headline:first-child>strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.ratio` | `scoped-subject` |
| `styles.css` | `(all)` | `.ratio strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.ratio span` | `scoped-subject` |
| `styles.css` | `(all)` | `.floating-amount` | `scoped-subject` |
| `styles.css` | `(all)` | `.floating-amount strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.floating-amount span` | `scoped-subject` |
| `styles.css` | `(all)` | `.location-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.location-card h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.location-card p` | `scoped-subject` |
| `styles.css` | `(all)` | `.app:has(.location-card) .scene-heading` | `scoped-subject` |
| `styles.css` | `(all)` | `.app:has(.location-card) .globe-coordinate` | `scoped-subject` |
| `styles.css` | `(all)` | `.debt-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.debt-card span` | `scoped-subject` |
| `styles.css` | `(all)` | `.debt-card strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.year-caption` | `scoped-subject` |
| `styles.css` | `(all)` | `.director` | `scoped-subject` |
| `styles.css` | `(all)` | `.director-head` | `scoped-subject` |
| `styles.css` | `(all)` | `.director-head h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-list` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-list button` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-list button[aria-pressed=true]` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-number` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-description` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-description strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-description small` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-duration` | `scoped-subject` |
| `styles.css` | `(all)` | `.director-controls` | `scoped-subject` |
| `styles.css` | `(all)` | `.director-controls button` | `scoped-subject` |
| `styles.css` | `(all)` | `.record-button` | `scoped-subject` |
| `styles.css` | `(all)` | `.director-help` | `scoped-subject` |
| `styles.css` | `(all)` | `.director-warning` | `scoped-subject` |
| `styles.css` | `(all)` | `.recording` | `scoped-subject` |
| `styles.css` | `(all)` | `.recording button` | `scoped-subject` |
| `styles.css` | `(all)` | `.recording input` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .topbar` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .ledger` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .ledger-toggle` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .bottom-panel` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .globe-coordinate` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .scene-heading` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .company-layer` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .amount-layer` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .shot-overlay` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .location-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.clean-frame .site-attribution` | `scoped-subject` |
| `styles.css` | `(all)` | `.loading` | `scoped-subject` |
| `styles.css` | `(all)` | `.loading h1` | `scoped-subject` |
| `styles.css` | `(all)` | `.loading p` | `scoped-subject` |
| `styles.css` | `(all)` | `.loading button` | `scoped-subject` |
| `styles.css` | `(all)` | `.loading-dot` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-error` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.ledger` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.ledger-parties` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.ledger-row-top` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.ledger-annotation` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.scene-heading` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.scene-heading h1` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.series-key` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.headline>strong` | `scoped-subject` |
| `styles.css` | `@media (min-width:1800px)` | `.date-block strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.topbar` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.brand-subtitle` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.network-status` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.story-selector` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.scene-heading` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.scene-heading h1` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.scene-heading p` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.scene-heading .eyebrow` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.ledger` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.bottom-panel` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.headline-counters` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.headline>strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.headline>span` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.series-key` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.date-block` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.date-block strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.date-block .eyebrow` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.globe-coordinate` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.director` | `scoped-subject` |
| `styles.css` | `@media (max-width:1300px)` | `.year-caption` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.scene-heading` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.ledger` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.ledger-parties` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.ledger-bottom strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.ledger-heading h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.bottom-panel` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.headline-counters` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.headline` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.headline>span` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.headline>strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.ratio` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.ratio span` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.date-block` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.date-block strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.series-key` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.speed-options button` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.transport` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.playback-state` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.timeline-months` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.topbar` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.brand` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.brand svg` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.story-selector button` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.director` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.year-caption` | `scoped-subject` |
| `styles.css` | `@media (max-width:850px)` | `.globe-coordinate` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .scene-heading` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .ledger` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .globe-coordinate` | `scoped-subject` |
| `styles.css` | `(all)` | `.shot-overlay` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-dimmer` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-card h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-card p` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-card .fine-print` | `scoped-subject` |
| `styles.css` | `(all)` | `.coin-layout` | `scoped-subject` |
| `styles.css` | `(all)` | `.dated-coin` | `scoped-subject` |
| `styles.css` | `(all)` | `.dated-coin>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.dated-coin small` | `scoped-subject` |
| `styles.css` | `(all)` | `.dated-coin strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.coin-date` | `scoped-subject` |
| `styles.css` | `(all)` | `.date-interval` | `scoped-subject` |
| `styles.css` | `(all)` | `.interval-line` | `scoped-subject` |
| `styles.css` | `(all)` | `.yield-track` | `scoped-subject` |
| `styles.css` | `(all)` | `.yield-track>div` | `scoped-subject` |
| `styles.css` | `(all)` | `.meter-label` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-card h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-card svg` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-grid` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-line` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-label` | `scoped-subject` |
| `styles.css` | `(all)` | `.curve-empty` | `scoped-subject` |
| `styles.css` | `(all)` | `.law` | `scoped-subject` |
| `styles.css` | `(all)` | `.law>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.law strong` | `scoped-subject` |
| `styles.css` | `(all)` | `.law p` | `scoped-subject` |
| `styles.css` | `(all)` | `.vault-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.vault-columns` | `scoped-subject` |
| `styles.css` | `(all)` | `.vault-columns dl` | `scoped-subject` |
| `styles.css` | `(all)` | `.vault-columns dl>div` | `scoped-subject` |
| `styles.css` | `(all)` | `.vault-columns dt` | `scoped-subject` |
| `styles.css` | `(all)` | `.vault-columns dd` | `scoped-subject` |
| `styles.css` | `(all)` | `.invariant-list>div` | `scoped-subject` |
| `styles.css` | `(all)` | `.invariant-list>.eyebrow` | `scoped-subject` |
| `styles.css` | `(all)` | `.check-light` | `scoped-subject` |
| `styles.css` | `(all)` | `.check-pass` | `scoped-subject` |
| `styles.css` | `(all)` | `.check-fail` | `scoped-subject` |
| `styles.css` | `(all)` | `.cube-overlay .globe-dimmer` | `scoped-subject` |
| `styles.css` | `(all)` | `.cube-caption` | `scoped-subject` |
| `styles.css` | `(all)` | `.cube-caption h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.reframe-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.reframe-card h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.reframe-card h2 span` | `scoped-subject` |
| `styles.css` | `(all)` | `.architecture-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.architecture-card h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.architecture-card img` | `scoped-subject` |
| `styles.css` | `(all)` | `.architecture-card a` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card h2>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card p` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card nav` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card a` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card a:hover` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card a span` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-footer` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .topbar .story-selector` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .network-status` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .bottom-panel` | `scoped-subject` |
| `styles.css` | `(all)` | `.close-card a svg` | `scoped-subject` |
| `styles.css` | `(all)` | `html` | `local-document` |
| `styles.css` | `(all)` | `#root` | `local-document` |
| `styles.css` | `(all)` | `.ledger-toggle` | `scoped-subject` |
| `styles.css` | `(all)` | `.globe-placeholder` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.topbar` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.topbar>*` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.brand` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.brand svg` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.story-selector` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.story-selector button` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.scene-heading` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.globe-coordinate` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.network-status` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.bottom-panel` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.timeline-region` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.timeline-top` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.date-block` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.date-block .eyebrow` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.date-block strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.series-key` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.volume-chart` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.chart-track` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.timeline-months` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.transport` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.transport .play-button` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.transport .icon-button` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.speed-options` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.speed-options button` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.headline-counters` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.headline` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.headline>span` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.headline>strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ratio` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ratio strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ratio span` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-toggle` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-toggle span` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-open .ledger` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-heading` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-heading h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-columns` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-row` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.ledger-foot` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.director` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.shot-list` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.director-head h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.director-help` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.director-controls` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.shot-list button` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.shot-description small` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.clean-frame .brand` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.year-caption` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.location-card` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.location-card h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.debt-card` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.debt-card strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.shot-overlay` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.globe-dimmer` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.overlay-card` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.overlay-card h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.overlay-card p` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.overlay-card .fine-print` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.coin-layout` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.dated-coin` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.dated-coin strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.dated-coin>span` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.coin-date` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.date-interval` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.meter-label` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.curve-label` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.curve-empty` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.curve-card svg` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.law` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.law strong` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.law p` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.vault-columns` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.vault-columns dl>div` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.reframe-card h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.reframe-card h2 span` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.close-card h2` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.close-card nav` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.close-card a` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.close-footer` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.cube-caption` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.cube-caption h2` | `scoped-subject` |
| `styles.css` | `(all)` | `.company-layer` | `scoped-subject` |
| `styles.css` | `(all)` | `.company-label` | `scoped-subject` |
| `styles.css` | `(all)` | `.company-disc` | `scoped-subject` |
| `styles.css` | `(all)` | `.company-disc svg` | `scoped-subject` |
| `styles.css` | `(all)` | `.company-disc img` | `scoped-subject` |
| `styles.css` | `(all)` | `.company-label>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.floating-amount>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.overlay-active .company-layer` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.company-disc` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.company-disc svg` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.company-disc img` | `scoped-subject` |
| `styles.css` | `@media (max-width:600px)` | `.company-label>span` | `scoped-subject` |
| `styles.css` | `(all)` | `.opening-cover` | `scoped-subject` |
| `styles.css` | `(all)` | `.opening-cover.opening-reveal` | `scoped-subject` |
| `styles.css` | `(all)` | `@font-face Inter` | `film-inter` |
| `styles.css` | `(all)` | `@font-face 'Coin Date Condensed'` | `coin-font` |
| `styles.css` | `(all)` | `@media (max-width:600px)` | `scoped-conditional` |
| `styles.css` | `(all)` | `@media (min-width:1800px)` | `scoped-conditional` |
| `styles.css` | `(all)` | `@media (max-width:1300px)` | `scoped-conditional` |
| `styles.css` | `(all)` | `@media (max-width:850px)` | `scoped-conditional` |
| `stage.css` | `(all)` | `.ledger` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-row` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-compact` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-compact .ledger-row` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-log-line` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-log-line time` | `scoped-subject` |
| `stage.css` | `(all)` | `.log-unit` | `scoped-subject` |
| `stage.css` | `(all)` | `.log-parties` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-log-line strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-columns button` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-expanded .ledger-row` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-card h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-card p` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-card .fine-print` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-card .eyebrow` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-card svg` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-card h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-label` | `scoped-subject` |
| `stage.css` | `(all)` | `.law strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.law>span` | `scoped-subject` |
| `stage.css` | `(all)` | `.law p` | `scoped-subject` |
| `stage.css` | `(all)` | `.vault-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.vault-columns` | `scoped-subject` |
| `stage.css` | `(all)` | `.vault-columns dl>div` | `scoped-subject` |
| `stage.css` | `(all)` | `.invariant-list>div` | `scoped-subject` |
| `stage.css` | `(all)` | `.close-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.close-card .close-wordmark` | `scoped-subject` |
| `stage.css` | `(all)` | `.close-card .close-phrase` | `scoped-subject` |
| `stage.css` | `(all)` | `.close-card a` | `scoped-subject` |
| `stage.css` | `(all)` | `.close-card .onchain-trigger` | `scoped-subject` |
| `stage.css` | `(all)` | `.close-footer` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-layout` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-copy` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-date` | `scoped-subject` |
| `stage.css` | `(all)` | `.fungible-equals` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-date~small` | `scoped-subject` |
| `stage.css` | `(all)` | `.claim-rule` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-date .dated-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-extend .dated-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.dated-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.date-interval` | `scoped-subject` |
| `stage.css` | `(all)` | `.meter-label` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li>span` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items p` | `scoped-subject` |
| `stage.css` | `(all)` | `.beat-pending` | `scoped-subject` |
| `stage.css` | `(all)` | `.beat-visible` | `scoped-subject` |
| `stage.css` | `(all)` | `.architecture-card>a` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.bottom-panel` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.volume-chart` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ledger` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ledger-compact .ledger-heading` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ledger-compact .ledger-heading h2` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ledger-compact .ledger-foot` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.shot-overlay` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.globe-dimmer` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.headline>span` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.series-key` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.speed-options button` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.date-block .eyebrow` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.timeline-months` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.chart-ceiling` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.speed-options button:last-child` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.headline>strong` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ratio span` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.eyebrow` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ledger-row-top` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.ledger-annotation` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.date-block strong` | `scoped-subject` |
| `stage.css` | `@media (min-width:851px) and (min-height:600px)` | `.location-card .eyebrow` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.ledger-compact` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.ledger-log-line` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.overlay-card h2` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.overlay-card p` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.overlay-card .eyebrow` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.overlay-card .fine-print` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.composable-items` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.composable-items li` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.composable-items strong` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.composable-items p` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.close-card .close-wordmark` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.close-card .close-phrase` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.curve-label` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.invariant-list>div` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.vault-columns dl>div` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.date-interval` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.meter-label` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.law strong` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.law>span` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.law p` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.close-card a` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.close-card .onchain-trigger` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.close-footer` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.ledger-compact` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.composable-items` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.architecture-card>a` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.coin-layout` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.fungible-equals` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-location` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-location strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-location span` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-narration` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-narration p` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.scene-location` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.scene-location strong` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.scene-location span` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.scene-narration` | `scoped-subject` |
| `stage.css` | `(all)` | `.ledger-inspecting` | `scoped-subject` |
| `stage.css` | `@media (max-width:850px)` | `.ledger-inspecting` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.ledger-inspecting` | `scoped-subject` |
| `stage.css` | `(all)` | `.director-active .scene-heading` | `scoped-subject` |
| `stage.css` | `(all)` | `.director-active .globe-coordinate` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .bottom-panel` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .timeline-top` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .chart-track` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .timeline-months` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .speed-options` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .playback-state` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .timeline-region` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .transport` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .headline-counters` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .headline` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .headline>span` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .ratio span` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .headline>strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .ratio strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.recording-hud) .ratio` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active .shot-overlay` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active .overlay-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active .ledger-toggle` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean:not(.recording-hud) .topbar` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean:not(.recording-hud) .bottom-panel` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean:not(.recording-hud) .ledger` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean:not(.recording-hud) .ledger-toggle` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean .shot-overlay` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean .scene-location` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-clean .scene-narration` | `scoped-subject` |
| `stage.css` | `(all)` | `.network-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.catch-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.network-card h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.catch-card h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-overlay-coin .globe-dimmer` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-overlay-treasury .globe-dimmer` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-overlay-network .globe-dimmer` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-stage` | `scoped-subject` |
| `stage.css` | `(all)` | `.twin-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-fungibility .dated-coin:first-child` | `scoped-subject` |
| `stage.css` | `(all)` | `.ghost-bill` | `scoped-subject` |
| `stage.css` | `(all)` | `.ghost-bill strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.ghost-bill span` | `scoped-subject` |
| `stage.css` | `(all)` | `.coin-claim .dated-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.asset-composition` | `scoped-subject` |
| `stage.css` | `(all)` | `.asset-composition b` | `scoped-subject` |
| `stage.css` | `(all)` | `.asset-composition small` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-ghost` | `scoped-subject` |
| `stage.css` | `(all)` | `.treasury-dates` | `scoped-subject` |
| `stage.css` | `(all)` | `.treasury-dates>div` | `scoped-subject` |
| `stage.css` | `(all)` | `.treasury-dates strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.treasury-dates span` | `scoped-subject` |
| `stage.css` | `(all)` | `.treasury-gap` | `scoped-subject` |
| `stage.css` | `(all)` | `.gap-highlight` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-card svg .curve-line` | `scoped-subject` |
| `stage.css` | `(all)` | `.curve-card svg .curve-grid` | `scoped-subject` |
| `stage.css` | `(all)` | `.film-exposure` | `scoped-subject` |
| `stage.css` | `(all)` | `.film-black` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-line` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-line p` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .shot-overlay` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .globe-dimmer` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .close-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .close-card p` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .close-card nav` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .close-card a` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .close-card button` | `scoped-subject` |
| `stage.css` | `(all)` | `.ending-wordmark .close-footer` | `scoped-subject` |
| `stage.css` | `(all)` | `.time-lapse-blur .globe-scene` | `scoped-subject` |
| `stage.css` | `(all)` | `.wordmark-icon` | `scoped-subject` |
| `stage.css` | `(all)` | `.treasury-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.yield-axis-bridge` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li:nth-child(4)` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li:nth-child(5)` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li:nth-child(2)::before` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li:nth-child(3)::before` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li:nth-child(4)::before` | `scoped-subject` |
| `stage.css` | `(all)` | `.composable-items li:nth-child(5)::before` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.scene-clean) .scene-location` | `scoped-subject` |
| `stage.css` | `(all)` | `.overlay-active:not(.scene-clean) .scene-narration` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-cue-context` | `scoped-subject` |
| `stage.css` | `(all)` | `.payment-timeline` | `scoped-subject` |
| `stage.css` | `(all)` | `.payment-timeline>span` | `scoped-subject` |
| `stage.css` | `(all)` | `.promise-track` | `scoped-subject` |
| `stage.css` | `(all)` | `.promise-track i` | `scoped-subject` |
| `stage.css` | `(all)` | `.promise-track b` | `scoped-subject` |
| `stage.css` | `(all)` | `.question-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.question-card .dated-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.date-stamp` | `scoped-subject` |
| `stage.css` | `(all)` | `.cascade-totals` | `scoped-subject` |
| `stage.css` | `(all)` | `.cascade-stat` | `scoped-subject` |
| `stage.css` | `(all)` | `.cascade-stat strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.cascade-stat span` | `scoped-subject` |
| `stage.css` | `(all)` | `.cascade-totals h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.backing-card small` | `scoped-subject` |
| `stage.css` | `(all)` | `.backing-card .asset-composition` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-overlay-promises .globe-dimmer` | `scoped-subject` |
| `stage.css` | `(all)` | `.promises-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.promise-graph` | `scoped-subject` |
| `stage.css` | `(all)` | `.promises-card h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-overlay-composable .globe-dimmer` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (max-aspect-ratio:1/1)` | `.cascade-totals` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (max-aspect-ratio:1/1)` | `.cascade-totals h2` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (max-aspect-ratio:1/1)` | `.backing-card .asset-composition` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (max-aspect-ratio:1/1)` | `.payment-timeline` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (max-aspect-ratio:1/1)` | `.question-card .dated-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording .story-selector` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording .network-status` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording .director` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud .topbar` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud .bottom-panel` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud .ledger` | `scoped-subject` |
| `stage.css` | `(all)` | `.app.recording-hud .shot-overlay` | `scoped-subject` |
| `stage.css` | `(all)` | `.app.recording-hud .scene-narration` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud .overlay-card` | `scoped-subject` |
| `stage.css` | `(all)` | `.app.recording-hud .scene-location` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud.overlay-active .ledger` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud.overlay-active .ledger-heading` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud.overlay-active .ledger-columns` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud.overlay-active .ledger-foot` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud.overlay-active .ledger-scroll` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud .globe-dimmer` | `scoped-subject` |
| `stage.css` | `(all)` | `.clean-frame .scene-location` | `scoped-subject` |
| `stage.css` | `(all)` | `.clean-frame .scene-narration` | `scoped-subject` |
| `stage.css` | `@media (max-width:600px) and (min-height:481px)` | `.recording-hud` | `scoped-subject` |
| `stage.css` | `(all)` | `.recording-hud .ending-line` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-orders` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-orders>div` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-orders strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-orders span` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-cascade` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-cascade>div` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-cascade span` | `scoped-subject` |
| `stage.css` | `(all)` | `.scene-cascade strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.dated-dollar` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .arc-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .amount-layer` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .floating-amount strong` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .question-card>.dated-dollar` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .coin-stage>.dated-dollar` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .extension-ticks` | `scoped-subject` |
| `stage.css` | `(all)` | `.extension-ticks i` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .date-interval` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .coin-fungibility` | `scoped-subject` |
| `stage.css` | `(all)` | `.same-date-stage` | `scoped-subject` |
| `stage.css` | `(all)` | `.swap-coin` | `scoped-subject` |
| `stage.css` | `(all)` | `.swap-coin .dated-dollar` | `scoped-subject` |
| `stage.css` | `(all)` | `.app:has(.same-date-stage)>:not(.shot-overlay)` | `scoped-subject` |
| `stage.css` | `(all)` | `.app:has(.same-date-stage) .shot-overlay` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .cascade-stat` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .cascade-totals h2` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .contract-line` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .shot-overlay` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .shot-overlay *` | `scoped-subject` |
| `stage.css` | `(all)` | `.app .shot-overlay .coin-fungibility` | `scoped-subject` |
| `stage.css` | `(all)` | `@keyframes card-in` | `namespaced-keyframes` |
| `stage.css` | `(all)` | `@keyframes coin-float` | `namespaced-keyframes` |
| `stage.css` | `(all)` | `@media (min-width:851px) and (min-height:600px)` | `scoped-conditional` |
| `stage.css` | `(all)` | `@media (max-width:850px)` | `scoped-conditional` |
| `stage.css` | `(all)` | `@media (max-width:600px) and (min-height:481px)` | `scoped-conditional` |
| `stage.css` | `(all)` | `@keyframes date-flip` | `namespaced-keyframes` |
| `stage.css` | `(all)` | `@keyframes pay-bill` | `namespaced-keyframes` |
| `stage.css` | `(all)` | `@keyframes bill-paid` | `namespaced-keyframes` |
| `stage.css` | `(all)` | `@media (max-width:600px) and (max-aspect-ratio:1/1)` | `scoped-conditional` |
| `stage.css` | `(all)` | `@keyframes coin-enter` | `namespaced-keyframes` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .topbar` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .brand` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .brand svg` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .brand-subtitle` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .story-selector` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .story-selector button` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .topbar>.onchain-trigger` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .bottom-panel` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .timeline-region` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .timeline-top` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .date-block` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .date-block strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .date-block .eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .series-key` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .series-key span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .chart-track` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .volume-chart` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .chart-ceiling` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scrubber` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .timeline-months` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .timeline-months span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .transport` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .play-button` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .transport .icon-button` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .transport svg` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .speed-options` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .speed-options button` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .speed-options button:last-child` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .playback-state` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .headline-counters` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .headline` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .headline>span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .headline>strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ratio` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ratio strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ratio span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-heading` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-heading h2` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-heading .eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-columns` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-foot` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .count` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-row` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-compact .ledger-row` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-log-line` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-row-top` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .sequence` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-parties` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-bottom strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-bottom>span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-annotation` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ledger-toggle` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .ledger` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .ledger-heading` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .ledger-columns` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .ledger-foot` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .ledger-scroll` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .ledger-log-line` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ledger` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ledger-heading` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ledger-columns` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ledger-foot` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ledger-scroll` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ledger-log-line` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .shot-overlay` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .scene-narration` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .ending-line` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud.ledger-sidebar .overlay-card` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-heading` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-heading h1` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-heading p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-heading .eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .globe-coordinate` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .shot-overlay` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .shot-overlay` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-narration` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .scene-narration` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .overlay-card` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .overlay-card>.eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .overlay-card h2` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .overlay-card p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .overlay-card .fine-print` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-location` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app.recording-hud .scene-location` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-location strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-location span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-narration p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .scene-cue-context` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ending-line` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ending-line p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .coin-layout` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .coin-stage` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .dated-coin` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .dated-coin strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .dated-coin>span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .dated-coin small` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .coin-date` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .date-interval` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .meter-label` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .extension-ticks` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .yield-track` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .claim-rule` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .fungible-equals` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ghost-bill` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ghost-bill strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .ghost-bill span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .question-card` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .question-card .dated-coin` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .question-card .dated-coin strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .contradiction-card` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .contradiction-card>.eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .contradiction-card>h2` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .payment-timeline` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .promise-track` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .promise-track i` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .promise-track b` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .cascade-totals` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .cascade-stat` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .cascade-stat strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .cascade-stat span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .asset-composition` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .asset-composition b` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .asset-composition small` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .backing-card>.onchain-trigger` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .laws-card .law` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .laws-card .law>span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .laws-card .law strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .laws-card .law p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .vault-card h2` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .vault-columns` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .vault-columns dl>div` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .vault-columns dt` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .vault-columns dd` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .invariant-list` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .invariant-list>.eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .invariant-list>div` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .check-light` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items li` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items li>span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items li:nth-child(2)::before` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items li:nth-child(3)::before` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items li:nth-child(4)::before` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .composable-items li:nth-child(5)::before` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .promise-graph` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .promises-card h2` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .close-card .close-wordmark` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .close-card .close-phrase` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .close-card nav` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .close-card a` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .close-card .onchain-trigger` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .close-footer` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .curve-card svg` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .curve-label` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .curve-empty` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .treasury-dates` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .treasury-dates strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .treasury-dates span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .treasury-gap` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .year-caption` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .site-attribution` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .location-card` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .location-card h2` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .location-card p` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .location-card .eyebrow` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .debt-card` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .debt-card span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .debt-card strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .floating-amount` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .floating-amount strong` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .floating-amount span` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .company-disc` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .company-disc svg` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .company-disc img` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio: 4/3)` | `.app .company-label>span` | `scoped-subject` |
| `film.css` | `(all)` | `.director-active .overlay-card *` | `scoped-subject` |
| `film.css` | `(all)` | `.recording .ledger` | `scoped-subject` |
| `film.css` | `(all)` | `.recording .ledger-row` | `scoped-subject` |
| `film.css` | `(all)` | `.company-callout` | `scoped-subject` |
| `film.css` | `(all)` | `.company-callout[hidden]` | `scoped-subject` |
| `film.css` | `(all)` | `.company-callout img` | `scoped-subject` |
| `film.css` | `(all)` | `.company-callout strong` | `scoped-subject` |
| `film.css` | `(all)` | `.company-callout span` | `scoped-subject` |
| `film.css` | `(all)` | `.rewind-readout` | `scoped-subject` |
| `film.css` | `(all)` | `.rewind-readout svg` | `scoped-subject` |
| `film.css` | `(all)` | `.rewind-readout>span` | `scoped-subject` |
| `film.css` | `(all)` | `.rewind-readout time` | `scoped-subject` |
| `film.css` | `(all)` | `.rewind-readout b` | `scoped-subject` |
| `film.css` | `(all)` | `.company-callout>div` | `scoped-subject` |
| `film.css` | `(all)` | `.overlay-active .company-layer` | `scoped-subject` |
| `film.css` | `(all)` | `.overlay-active .company-label` | `scoped-subject` |
| `film.css` | `(all)` | `.site-navigation` | `scoped-subject` |
| `film.css` | `(all)` | `.site-navigation button` | `scoped-subject` |
| `film.css` | `(all)` | `.site-navigation svg` | `scoped-subject` |
| `film.css` | `(all)` | `.site-focused .scene-heading` | `scoped-subject` |
| `film.css` | `(all)` | `.site-focused .globe-coordinate` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .brand-subtitle` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .network-status` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .site-navigation` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .site-navigation button` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .site-navigation svg` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .topbar` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .story-selector` | `scoped-subject` |
| `film.css` | `@media (min-aspect-ratio:4/3)` | `.app .story-selector button` | `scoped-subject` |
| `film.css` | `@media (max-aspect-ratio:4/3)` | `.site-navigation` | `scoped-subject` |
| `film.css` | `@media (max-aspect-ratio:4/3)` | `.site-navigation button` | `scoped-subject` |
| `film.css` | `@media (max-aspect-ratio:4/3)` | `.site-navigation svg` | `scoped-subject` |
| `film.css` | `(all)` | `.app.california-hook .company-layer` | `scoped-subject` |
| `film.css` | `(all)` | `.app.california-hook .company-callout` | `scoped-subject` |
| `film.css` | `(all)` | `.app.california-hook .company-label[data-firm="Apple"] .company-disc` | `scoped-subject` |
| `film.css` | `(all)` | `.app.california-hook .company-label[data-firm="Apple"] .company-logo` | `scoped-subject` |
| `film.css` | `(all)` | `.app.california-hook .company-label[data-firm="Apple"]>span` | `scoped-subject` |
| `film.css` | `(all)` | `@media (min-aspect-ratio: 4/3)` | `scoped-conditional` |
| `film.css` | `(all)` | `@media (min-aspect-ratio:4/3)` | `scoped-conditional` |
| `film.css` | `(all)` | `@media (max-aspect-ratio:4/3)` | `scoped-conditional` |
<!-- containment-table:end -->

## Validation

Run from `film/`:

```sh
npm run test:w0
npx tsc --noEmit
```

Node tests cover independent geometry sweeps (10,201 p/s pairs), actual frame
math at 4/15/30fps including overlapping spans, original BrowserFrame element
objects from pinned origin/main (961 p/s pairs), all legacy caller modes,
scene-2 and phone source parity, exact mirror/projection matrix checks,
transition clamping, margins/fullscreen appearance, and pane clearance across
all 25 preset pairs. CSS tests cover inventory completeness, emitted selector
containment, typography declarations, custom properties, font/keyframe handling,
film-unit arithmetic, surface overrides and import boundaries. A compiler-only
webpack test uses the real configured pre-loader and Remotion CSS pipeline,
asserting that the three stylesheets are the only app-source dependencies.
It neither executes the emitted bundle nor binds a port.

Baseline and post-change film typecheck both exit 2 with **116 identical diagnostic
lines**, all in the existing app graph: TS2307 ×54, TS7006 ×30, TS2875 ×13,
TS2339 ×15, TS7019 ×1, TS4112 ×3. **Zero introduced diagnostics.** The captured
before/after logs were compared byte-for-byte. No strictness relaxation, app edit,
or suppression was used.

## Pixel comparison on an allowed render host ONLY

Do not run these instructions on do-box or do-mac. Use an authorised render VM
or other permitted host with the same Chromium build, fonts, OS, GPU settings,
and locked app/film dependencies for both checkouts. This test uses captures;
live network/app state is not a reproducible pixel baseline. Renderer output
scale and composition fps must be identical on both sides.

Once W0 has a reviewable commit, set `W0_REV` to that revision and create two
checkouts (`BEFORE` and `AFTER`) from this repository:

```sh
BASE_REV=5de49fa24665a0d162ed0b66913a594181d3979f
W0_REV=<W0-commit>
BEFORE=/tmp/cascade-w0-before
AFTER=/tmp/cascade-w0-after
git worktree add --detach "$BEFORE" "$BASE_REV"
git worktree add --detach "$AFTER" "$W0_REV"
```

Install each checkout's locked dependencies. Copy an identical snapshot of the
current `film/public/` (including untracked captures, narration and fonts) into
both checkouts. Compare file SHA-256 manifests of those directories first. Leave
tracked `src/generated/` data at the checked-out revision; W0 does not change it.
Do not run `render-scenes.sh`: it regenerates cue/capture metadata before rendering.

In **each checkout's `film/` directory**, compute the final scene-2 frame with the
actual schedule/narration functions using filesystem-backed fetch, without a
server. Then render frames 0 through that inclusive endpoint:

```sh
END_S2=$(node --input-type=module - <<'JS'
import {readFileSync} from 'node:fs';
import {loadNarration} from './src/compositions/narration.ts';
import {resolveSceneDurations} from './src/compositions/schedule.ts';
globalThis.fetch = async () => new Response(readFileSync('public/narration/narration.json', 'utf8'));
const durations = resolveSceneDurations(await loadNarration(30), 30);
console.log(durations[0] + durations[1] - 1);
JS
)
npx remotion render src/index.ts CascadeFilm out/w0-frames \
  --sequence --image-format=png --scale=1 --concurrency=1 \
  --frames="0-$END_S2" --props='{"fps":30,"source":"captures","reviewLabels":false}'
```

Require equal `END_S2` values. Where local port policy applies, use that host's
canonical port allocator and pass the allocated `--port` to Remotion. The
filesystem-only endpoint calculation above does not bind a port.

Compare decoded RGBA pixels, not PNG encodings (requires Python Pillow):

```sh
python3 - "$BEFORE/film/out/w0-frames" "$AFTER/film/out/w0-frames" <<'PY'
from pathlib import Path
from PIL import Image
import sys
before, after = map(Path, sys.argv[1:])
a, b = sorted(before.glob('*.png')), sorted(after.glob('*.png'))
assert a and [p.name for p in a] == [p.name for p in b], 'frame set mismatch'
for left, right in zip(a, b):
    with Image.open(left) as im_a, Image.open(right) as im_b:
        im_a, im_b = im_a.convert('RGBA'), im_b.convert('RGBA')
        assert im_a.size == im_b.size and im_a.tobytes() == im_b.tobytes(), left.name
print(f'{len(a)} frames: zero differing pixels')
PY
```

The local structural tests establish identical inputs and browser element/style
objects for scenes 1 and 2. They do not substitute a claim that this deferred
pixel comparison was executed.

## Deliberately outside W0

- No app edits, scene-content rebuilds, narration/cue/schedule changes, capture
  modifications, or migration of existing film brand tokens.
- `ledgerSidebar` only exposes the class. Its app-owned rules arrive with
  `app/v5` (based on `app/v5-data`); none exist in this checkout. The CSS inventory
  gate will require review of that merge's new selectors/conditional rules.
- Known existing defect: `Root.tsx` statically imports `AppFrame`, despite the
  lazy-import explanation in CascadeFilm.tsx. That graph (and its raw app CSS)
  already exists on the baseline. This work does not repair it or rewrite the
  live app's CSS imports; the new surface imports add no app JavaScript and no
  uncontained document selectors.
- No guarantee that an arbitrary wide app card fits a narrow presentation column;
  future scene workers own content layout, without shrinking the app typography.
- No commit, browser launch, renderer invocation, Playwright run, or deployment.

## W0LayoutProbe: render-host handoff

Registered at 1920×1080, 30 fps, 900 frames (30 seconds), with burned-in shot
number, preset/transition, global/local frame, pane side and available width.
`debugOutlines` defaults to true (pink projected corners and bounding rectangle;
cyan presentation column). Set it false for clean styling inspection; labels
remain visible. This diagnostic composition does not use captures or mount App.
It uses a reference grid in the window and a real `.overlay-card.cascade-totals`
card with `.cascade-stat` children in the pane. Card layout is one column, with
app typography and colours unchanged. Its parent deliberately uses `position:
fixed; inset: 0` to expose containment failures. The card should clip as space
shrinks; fullscreen has zero free space and must hide it completely.

| Shot | Frames | Layout | Pane |
| --- | --- | --- | --- |
| 01 | 0–89 | skewLeft | right |
| 02 | 90–179 | centerSmall | right |
| 03 | 180–269 | skewRight | left |
| 04 | 270–359 | centerLarge | right (collapsed) |
| 05 | 360–449 | fullscreen | right (collapsed) |
| 06 | 450–539 | skewLeft → centerSmall | right |
| 07 | 540–629 | centerSmall → skewRight | left |
| 08 | 630–719 | skewRight → centerLarge | left |
| 09 | 720–809 | fullscreen → skewLeft | right |
| 10 | 810–899 | skewRight → fullscreen | left |

Every transition holds the start for 15 frames, moves over 60 frames, and holds
the finish. The tree persists across shots, including fullscreen boundaries.
Small centered layouts leave narrow columns; clipping there is intentional,
not an instruction for scene workers to shrink the app's font sizes.

Run **only on the authorized rendering host**, from `film/`:

```bash
npx remotion render src/index.ts W0LayoutProbe out/w0-layout-probe.mp4
# Optional clean version:
npx remotion render src/index.ts W0LayoutProbe out/w0-layout-probe-clean.mp4 --props='{"debugOutlines":false}'

# Ten rows, three columns: held start / midpoint / held finish of each shot.
mkdir -p out/w0-probe-sheet
for shot in $(seq 0 9); do
  for local in 15 45 75; do
    frame=$((shot * 90 + local))
    name=$(printf '%03d' "$frame")
    npx remotion still src/index.ts W0LayoutProbe "out/w0-probe-sheet/$name.png" --frame="$frame" --scale=0.3333333333
  done
done
# ImageMagick on the render host; zero-padded names preserve shot order.
magick montage out/w0-probe-sheet/*.png -tile 3x10 -geometry +4+4 out/w0-layout-contact-sheet.png
```

Inspect full-resolution frames for type and boundaries; the contact sheet is
for scene order and movement. Confirm that no fixed card paints over the grid,
that projected outlines track the window, and that fullscreen has no residual
border, inset or chrome. These commands have not been executed here. The deferred
baseline scenes 1–2 pixel-comparison commands above remain required separately.

Stage 4 adds Node regressions for actual React state/effect preservation through
forward/reverse fullscreen transitions and seeks; fixed-pane containment styles;
frozen presets and rejected invalid geometry; conservative selector inventory
(including `.app + .caption`, `.app ~ .caption`, and logical selectors); and probe
coverage/labels/debug toggles. The inventory now contains 859 reviewed rows.
The Node React test package is pinned to the app's React version; it emits its
upstream deprecation notice. It is test-only and neither launches a browser nor
validates CSS painting. Browser inspection remains the render-host acceptance.
