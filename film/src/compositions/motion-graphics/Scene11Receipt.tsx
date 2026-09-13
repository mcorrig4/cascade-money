import React from 'react';
import {AbsoluteFill, Freeze, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, font, scrim, type} from '../../brand/tokens';
import {CaptureScene} from '../../components/CaptureScene';
import {at30, CLAMP} from '../../motion/timing';

/** Shared geometry keeps the receipt and phone continuous across the scene cut. */
export const RECEIPT_LAYOUT = {left: 140, top: 230, width: 640, height: 620, itemDividerY: 254};

export const AppleParkBackdrop: React.FC<{
  timelineOffsetInFrames?: number;
  darken?: number;
}> = ({timelineOffsetInFrames = 0, darken = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const captureFrames = Math.max(1, at30(89, fps));
  // One take across both scenes, followed by the same held dusk frame.
  const captureFrame = Math.min(timelineOffsetInFrames + frame, captureFrames - 1);
  return (
    <AbsoluteFill>
      <Freeze frame={captureFrame}>
        <CaptureScene
          src="shot-01-apple-park.mp4"
          captureDurationInFrames={captureFrames}
          startFrom={0}
          mode="bleed"
          progress={0}
        />
      </Freeze>
      <AbsoluteFill style={{background: scrim, opacity: 0.75}} />
      <AbsoluteFill style={{background: color.bgOuter, opacity: darken}} />
    </AbsoluteFill>
  );
};

export const PurchaseReceipt: React.FC<{style?: React.CSSProperties}> = ({style}) => {
  const line = (label: string, amount: string, top: number, total = false) => (
    <div style={{
      position: 'absolute', left: 48, right: 48, top,
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      color: total ? color.money : color.fgDim,
      fontSize: total ? type.cardTitle * 0.75 : type.closeBody,
      fontWeight: total ? 650 : 450,
    }}>
      <span>{label}</span><span>{amount}</span>
    </div>
  );
  return (
    <div style={{
      position: 'relative', width: RECEIPT_LAYOUT.width, height: RECEIPT_LAYOUT.height,
      boxSizing: 'border-box', border: `1px solid ${color.hairline}`, borderRadius: 12,
      background: color.bgInner, color: color.fg, fontFamily: font.family,
      fontVariantNumeric: 'tabular-nums', ...style,
    }}>
      <div style={{position: 'absolute', left: 48, top: 48, fontSize: type.cardBody, letterSpacing: 5, color: color.fgDim}}>
        RECEIPT
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 116, borderTop: `1px dashed ${color.hairline}`}} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 176, display: 'flex', justifyContent: 'space-between', fontSize: type.closeBody, fontWeight: 550}}>
        <span>iPhone Duo</span><span>$1,199.00</span>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: RECEIPT_LAYOUT.itemDividerY, borderTop: `1px solid ${color.hairline}`}} />
      {line('Subtotal', '$1,199.00', 310)}
      {line('Tax', '$95.92', 380)}
      <div style={{position: 'absolute', left: 48, right: 48, top: 458, borderTop: `1px dashed ${color.hairline}`}} />
      {line('Total', '$1,294.92', 506, true)}
    </div>
  );
};

export const ReceiptPhone: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <Img
    src={staticFile('assets/iphone-duo-hands.png')}
    style={{position: 'absolute', right: 60, top: 108, height: 864, width: 864 * (1429 / 1101), objectFit: 'contain', ...style}}
  />
);

/** Scene 11 — an ordinary consumer purchase, with no payment-rail attribution. */
export const Scene11Receipt: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const phoneOpacity = interpolate(frame, [0, dur * 0.14], [0, 1], CLAMP);
  const phoneScale = interpolate(frame, [dur * 0.14, dur * 0.18], [1.03, 1], CLAMP);
  const receiptIn = interpolate(frame, [dur * 0.24, dur * 0.4], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      <AppleParkBackdrop />
      <div style={{position: 'absolute', width: 1920, height: 1080, transformOrigin: 'top left', transform: `scale(${width / 1920}, ${height / 1080})`}}>
        <ReceiptPhone style={{opacity: phoneOpacity, transform: `scale(${phoneScale})`}} />
        <div style={{position: 'absolute', left: RECEIPT_LAYOUT.left, top: RECEIPT_LAYOUT.top, opacity: receiptIn, transform: `translateX(${-36 * (1 - receiptIn)}px)`}}>
          <PurchaseReceipt />
        </div>
      </div>
    </AbsoluteFill>
  );
};
