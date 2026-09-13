import {Config} from '@remotion/cli/config';
import {resolve} from 'node:path';
import webpack from 'webpack';

const filmDir = process.cwd();

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
// Two concurrent scene renders at concurrency=6 can leave a browser worker
// CPU-starved for several minutes on the dev Mac. Readiness is deterministic,
// so allow the worker to resume instead of mistaking scheduler delay for a
// missing texture/font/model.
Config.setDelayRenderTimeoutInMilliseconds(1_200_000);
Config.overrideWebpackConfig(current => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...current.resolve?.alias,
      '@cascade-app': resolve(filmDir, '../app/src'),
      // Prefix aliases, not exact ones: the app tree has its own (older) React
      // in app/node_modules, and a DEEP import from it (react-dom/client, any
      // react/jsx-runtime) slips past a `react$` exact alias and loads a second
      // copy — React then throws #527 (react 19.2.7 vs react-dom 19.2.4) the
      // moment the live app actually mounts. One React for the whole bundle.
      react: resolve(filmDir, 'node_modules/react'),
      'react-dom': resolve(filmDir, 'node_modules/react-dom'),
    },
    // app/src/styles.css's `url('/fonts/RobotoCondensed-Light.woff2')` (the
    // coin-v3/stage18 merge's dated-dollar font, 2026-09-13) is a root-
    // relative CSS url. Webpack treats a leading "/" as ALREADY absolute
    // and, for a `resolve.roots`-eligible request, strips the slash and
    // resolves it relative to each configured root — with none configured
    // it only tries the compiler context (film/), never `public/`, so any
    // render that touches app/src failed with "Can't resolve
    // '/fonts/RobotoCondensed-Light.woff2'" (verified: every scene's
    // bundle includes the full CascadeFilm module graph regardless of
    // which frames are rendered, so this broke ALL renders, not just ones
    // using the coin — and NOT `resolve.modules`, which doesn't apply to
    // requests webpack already treats as absolute paths; that was tried
    // first and had no effect on this specific error). film's own fonts
    // avoid this entirely by loading via FontFace()/fetch(staticFile(...))
    // (see brand/fonts.ts) instead of a CSS @font-face import.
    roots: [...(current.resolve?.roots ?? []), resolve(filmDir, 'public'), resolve(filmDir, '../app/public')],
  },
  plugins: [
    ...(current.plugins ?? []),
    new webpack.DefinePlugin({
      'import.meta.env.BASE_URL': "window.remotion_staticBase + '/'",
      'import.meta.env.VITE_ENABLE_TILES': JSON.stringify('0'),
      'import.meta.env.VITE_GOOGLE_TILES_KEY': 'undefined',
      'import.meta.env.VITE_PUBLIC_APP_URL': 'undefined',
      'import.meta.env.VITE_TEAM': 'undefined',
      __SITE_MODEL_VERSIONS__: JSON.stringify({
        'apple-park': 'remotion-spike',
        'fifth-avenue': 'remotion-spike',
        'fifth-avenue-tiles': 'remotion-spike',
      }),
    }),
  ],
}));
