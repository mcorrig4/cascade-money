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
      react$: resolve(filmDir, 'node_modules/react'),
      'react-dom$': resolve(filmDir, 'node_modules/react-dom'),
    },
    // app/src/styles.css's `url('/fonts/RobotoCondensed-Light.woff2')` (the
    // coin-v3/stage18 merge's dated-dollar font, 2026-09-13) is a root-
    // relative CSS url — css-loader v6+ resolves those through webpack's
    // normal module resolution rather than serving them from `public/`
    // directly, so without a `resolve.modules` entry pointing at the
    // public dirs any render that touches app/src fails with "Can't
    // resolve '/fonts/RobotoCondensed-Light.woff2'" (verified: every
    // scene's bundle includes the full CascadeFilm module graph regardless
    // of which frames are rendered, so this broke ALL renders, not just
    // ones using the coin). film's own fonts avoid this by loading via
    // FontFace()/fetch(staticFile(...)) (see brand/fonts.ts) instead of a
    // CSS @font-face import.
    // 'node_modules' must stay first and explicit: webpack only supplies
    // that default itself when `resolve.modules` is left UNSET entirely,
    // so appending to `current.resolve?.modules` (empty/undefined here)
    // would otherwise silently drop normal node_modules resolution for
    // every bare import (verified: doing that broke 'globe.gl'/'three').
    modules: [...(current.resolve?.modules ?? ['node_modules']), resolve(filmDir, 'public'), resolve(filmDir, '../app/public')],
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
