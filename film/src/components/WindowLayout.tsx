import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {BrowserFrame} from './BrowserFrame';
import {windowGeometryAt, type WindowLayoutSpec} from './windowGeometry';

export {WINDOW_PRESETS} from './windowGeometry';
export type {WindowGeometry, WindowLayoutSpec, WindowPreset} from './windowGeometry';

export const useWindowGeometry = (spec: WindowLayoutSpec) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return windowGeometryAt(spec, frame, width, height);
};

export const WindowLayout: React.FC<WindowLayoutSpec & {
  children: React.ReactNode;
  legacyFrameAppearance?: boolean;
}> = ({children, legacyFrameAppearance = false, ...spec}) => {
  const geometry = useWindowGeometry(spec);
  return <BrowserFrame
    // Keep the same parents at chrome=0 so live app state survives the boundary.
    mode="framed"
    chrome="browser" progress={geometry.chromeProgress} geometry={geometry}
    legacyFrameAppearance={legacyFrameAppearance}
  >{children}</BrowserFrame>;
};
