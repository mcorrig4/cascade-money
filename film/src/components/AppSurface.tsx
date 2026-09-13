import React from 'react';
import {useVideoConfig} from 'remotion';
// Query imports use the film's scoping loader; no app JavaScript is imported.
// Keep the app's cascade order: film.css overrides both preceding sheets.
import '@cascade-app/styles.css?app-surface';
import '@cascade-app/stage.css?app-surface';
import '@cascade-app/film.css?app-surface';
import './AppSurface.css';
import {ensureFontsLoaded} from '../brand/fonts';
import {appSurfaceStyle, filmUnitFor} from './appSurfaceGeometry';
import {presentationRect, type WindowGeometry} from './windowGeometry';

export const AppSurface: React.FC<{
  children: React.ReactNode;
  ledgerSidebar?: boolean;
  className?: string;
}> = ({children, ledgerSidebar = false, className = ''}) => {
  const {width, height} = useVideoConfig();
  ensureFontsLoaded();
  return <div className={`app recording-hud film-app-surface${ledgerSidebar ? ' ledger-sidebar' : ''} ${className}`}
    style={appSurfaceStyle(width, height)}>{children}</div>;
};

/** Pass the SAME hook result used by the window, in the same Sequence time.
 * The pane clips oversized cards, not the surface: no content can spill across
 * the window when a cue moves it into the remaining presentation column.
 */
export const PresentationPane: React.FC<{
  side: 'left' | 'right';
  geometry: WindowGeometry;
  children: React.ReactNode;
  padding?: number;
  verticalAlign?: 'start' | 'center' | 'end';
}> = ({side, geometry, children, padding = 32 * filmUnitFor(geometry.width, geometry.height), verticalAlign = 'center'}) => {
  const rect = presentationRect(geometry, side, padding);
  return <div style={{position: 'absolute', left: rect.left, top: rect.top,
    width: rect.width, height: rect.height, display: 'grid', alignItems: verticalAlign,
    // Fixed app cards must resolve against this column and paint only inside it.
    contain: 'layout paint', gridTemplateColumns: 'minmax(0, 1fr)', overflow: 'hidden', pointerEvents: 'none',
    visibility: rect.width === 0 || rect.height === 0 ? 'hidden' : 'visible',
  }}>{children}</div>;
};
