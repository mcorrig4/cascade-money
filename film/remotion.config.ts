import {Config} from '@remotion/cli/config';
import {resolve} from 'node:path';
import webpack from 'webpack';

const filmDir = process.cwd();

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setDelayRenderTimeoutInMilliseconds(300_000);
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
