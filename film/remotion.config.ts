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
