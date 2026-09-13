import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, font, type} from '../../brand/tokens';
import {CLAMP} from '../../motion/timing';
import {cueFrame, SceneCues} from '../../cues';
import {PaymentNetwork} from './PaymentNetwork';

/** Shared geometry keeps the receipt and phone continuous across the scene cut. */
export const RECEIPT_FINAL_TOP = 56;
export const RECEIPT_FINAL_SCALE = 0.48;
export const PHONE_DIM_OPACITY = 0.4;
export const RECEIPT_LAYOUT = {left: 140, top: 230, width: 640, height: 620, itemDividerY: 254};

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
        <span>iPhone Duo</span><span>$1,999.00</span>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: RECEIPT_LAYOUT.itemDividerY, borderTop: `1px solid ${color.hairline}`}} />
      {line('Subtotal', '$1,999.00', 310)}
      {line('Tax', '$159.92', 380)}
      <div style={{position: 'absolute', left: 48, right: 48, top: 458, borderTop: `1px dashed ${color.hairline}`}} />
      {line('Total', '$2,158.92', 506, true)}
    </div>
  );
};

export const ReceiptPhone: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <Img
    src={staticFile('assets/iphone-duo-hands.png')}
    style={{position: 'absolute', right: 60, top: 108, height: 864, width: 864 * (1429 / 1101), objectFit: 'contain', ...style}}
  />
);

/** Shared final picture makes scene 12's first frame identical to scene 11's last. */
export const ReceiptNetworkPicture: React.FC<{
  move?: number;
  phoneOpacity?: number;
  phoneScale?: number;
  receiptIn?: number;
  drawProgress?: number;
}> = ({move = 1, phoneOpacity = PHONE_DIM_OPACITY, phoneScale = 1, receiptIn = 1, drawProgress = 1}) => {
  const {width, height} = useVideoConfig();
  const receiptScale = 1 + (RECEIPT_FINAL_SCALE - 1) * move;
  const receiptTop = RECEIPT_LAYOUT.top + (RECEIPT_FINAL_TOP - RECEIPT_LAYOUT.top) * move;
  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1920, height: 1080, transformOrigin: 'top left', transform: `scale(${width / 1920}, ${height / 1080})`}}>
        <ReceiptPhone style={{opacity: phoneOpacity, transform: `scale(${phoneScale})`}} />
        <div style={{position: 'absolute', left: RECEIPT_LAYOUT.left, top: receiptTop, opacity: receiptIn, transformOrigin: 'top left', transform: `translateX(${-36 * (1 - receiptIn)}px) scale(${receiptScale})`}}>
          <PurchaseReceipt />
        </div>
        <PaymentNetwork drawProgress={drawProgress} />
      </div>
    </AbsoluteFill>
  );
};

/** Scene 11 — the purchase opens into its cascading supplier payments. */
export const Scene11Receipt: React.FC<{durationInFrames: number; cues?: SceneCues}> = ({durationInFrames: dur, cues}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Reserve positive intervals even for unusually short preview sequences.
  const gap = Math.min(1, dur / 4);
  const revealAt = Math.max(0, Math.min(dur - 3 * gap, cueFrame(cues, 'chain-reveal', fps, dur * 0.3)));
  const shrinkEnd = Math.min(dur - 2 * gap, revealAt + Math.max(gap, fps * 0.5));
  const drawEnd = Math.max(shrinkEnd + gap, dur - Math.max(gap, fps * 0.3));
  const move = interpolate(frame, [revealAt, shrinkEnd], [0, 1], {...CLAMP, easing: Easing.inOut(Easing.cubic)});
  const phoneOpacity = interpolate(frame, [0, dur * 0.14], [0, 1], CLAMP) * (1 - (1 - PHONE_DIM_OPACITY) * move);
  const phoneScale = interpolate(frame, [dur * 0.14, dur * 0.18], [1.03, 1], CLAMP);
  // Preserve the original entrance until the cue, then finish it smoothly as we shrink.
  const originalReceiptIn = interpolate(frame, [dur * 0.24, dur * 0.4], [0, 1], CLAMP);
  const receiptInAtCue = interpolate(revealAt, [dur * 0.24, dur * 0.4], [0, 1], CLAMP);
  const receiptIn = frame < revealAt ? originalReceiptIn : receiptInAtCue + (1 - receiptInAtCue) * move;
  const drawProgress = interpolate(frame, [shrinkEnd, drawEnd], [0, 1], CLAMP);
  return <ReceiptNetworkPicture move={move} phoneOpacity={phoneOpacity} phoneScale={phoneScale} receiptIn={receiptIn} drawProgress={drawProgress} />;
};
