# W2 pending app integration review

The film imports `DatedDollar` directly through `@cascade-app/components/DatedDollar` and scopes the app's own styles through `AppSurface`. The current film checkout still contains the amber-plus component. The green USD+ implementation, recording presentation suppression, and recording sidebar rules are pending integration from **app/v5 `eb4c86635afc385145919795f9cb06ddd1ce3a63`**. W2 deliberately does not edit `app/`, recolour a duplicate SVG, or claim the pending app behavior is already present.

The review compares this film checkout's HEAD to that app commit. Exactly eleven selector subjects are added across the imported stylesheets:

| Stylesheet / context | Added selector |
|---|---|
| `app/src/film.css`, `@media (min-aspect-ratio:4/3)` | `.app.recording-hud.ledger-sidebar .ledger` |
| same | `.app.recording-hud.ledger-sidebar .ledger-heading` |
| same | `.app.recording-hud.ledger-sidebar .ledger-columns` |
| same | `.app.recording-hud.ledger-sidebar .ledger-foot` |
| same | `.app.recording-hud.ledger-sidebar .ledger-scroll` |
| same | `.app.recording-hud.ledger-sidebar .ledger-log-line` |
| same | `.app.recording-hud.ledger-sidebar .shot-overlay` |
| same | `.app.recording-hud.ledger-sidebar .scene-narration` |
| same | `.app.recording-hud.ledger-sidebar .ending-line` |
| same | `.app.recording-hud.ledger-sidebar .overlay-card` |
| `app/src/stage.css`, all media | `.app .question-card>.dated-dollar` |

The ledger rules restore the sidebar's product geometry and type scale in recording mode; overlay rules reserve its horizontal space. The question-card rule constrains the imported token to its app card. Every selector remains rooted in `.app`; none intentionally targets the Remotion document or film siblings.

The integration agent ran the prospective sheets through `containCss`: **styles.css 388 subject guards, stage.css 280, film.css 218**. Every selector subject was guarded. There are no new at-rules, font-face declarations, or keyframes in this delta. This is a prospective containment review, not evidence of merged app code.

The later assembly gate must integrate the app lane, regenerate/update the containment inventory from the actual integrated CSS, and rerun its containment checks. Do not pre-populate today's baseline inventory with selectors absent from today's files. Then verify green tokens, presentation suppression, full sidebar presence, and supplier-label removal using the new captures on the render host. This prospective CSS review used no browser or renderer; W2 cannot certify those footage-dependent results. Separately, the W2 validation suite unintentionally executed one Node React test-renderer test after an exclusion filter failed. No browser or video renderer ran.
