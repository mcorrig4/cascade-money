import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, font, type} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';
import {CLAMP} from '../../motion/timing';
import {AppleParkBackdrop, PurchaseReceipt, RECEIPT_LAYOUT, ReceiptPhone} from './Scene11Receipt';

const SUPPLIERS = [
  {label: 'Apple', logo: 'apple'},
  {label: 'Samsung Display', logo: 'samsung'},
  {label: 'Corning', logo: 'corning'},
  {label: 'Silica / specialty chemicals', logo: null},
  {label: 'Refiner', logo: null},
  {label: 'Freight', logo: null},
  {label: 'Dow', logo: 'dow'},
  {label: 'Rail', logo: null},
] as const;

const CHAIN_X = 750;
// Clears the 26px badge radius plus the coin's 20px bounding-box radius.
const COIN_TRACK_X = CHAIN_X - 48;
const rowY = (index: number) => 400 + index * 60;
const rowAt = (index: number) => 0.18 + (index * 0.5) / (SUPPLIERS.length - 1);
const rowReadyAt = (index: number) => rowAt(index) + 0.025;

/** Scene 12 — the purchase's suppliers, then the payment rail underneath them. */
export const Scene12SupplierChain: React.FC<{
  durationInFrames: number;
  previousSceneDurationInFrames: number;
}> = ({durationInFrames: dur, previousSceneDurationInFrames}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const move = interpolate(frame, [0, dur * 0.16], [0, 1], CLAMP);
  const receiptScale = 1 - move * 0.52;
  const receiptLeft = RECEIPT_LAYOUT.left + (806.4 - RECEIPT_LAYOUT.left) * move;
  const receiptTop = RECEIPT_LAYOUT.top + (56 - RECEIPT_LAYOUT.top) * move;
  const contextOpacity = interpolate(frame, [dur * 0.76, dur * 0.84], [1, 0.3], CLAMP);
  const markIn = interpolate(frame, [dur * 0.74, dur * 0.84], [0, 1], CLAMP);
  const headerIn = interpolate(frame, [dur * 0.16, dur * rowReadyAt(0)], [0, 1], CLAMP);
  const coinY = interpolate(
    frame,
    [...SUPPLIERS.map((_, i) => dur * rowReadyAt(i)), dur * 0.8],
    [...SUPPLIERS.map((_, i) => rowY(i)), 943],
    CLAMP,
  );
  // Stay beside every supplier; converge only after clearing the final row.
  const coinX = interpolate(coinY, [rowY(SUPPLIERS.length - 1) + 52, 943], [COIN_TRACK_X, CHAIN_X], CLAMP);
  const coinOpacity = interpolate(frame, [dur * rowAt(0), dur * rowReadyAt(0), dur * 0.78, dur * 0.84], [0, 1, 1, 0], CLAMP);
  const branchIn = interpolate(frame, [dur * 0.16, dur * rowReadyAt(0)], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      <AppleParkBackdrop
        timelineOffsetInFrames={previousSceneDurationInFrames}
        darken={interpolate(frame, [0, dur * 0.84], [0, 0.96], CLAMP)}
      />
      <div style={{position: 'absolute', width: 1920, height: 1080, fontFamily: font.family, color: color.fg, transformOrigin: 'top left', transform: `scale(${width / 1920}, ${height / 1080})`}}>
        <ReceiptPhone style={{opacity: 1 - move}} />
        <div style={{position: 'absolute', left: receiptLeft, top: receiptTop, transformOrigin: 'top left', transform: `scale(${receiptScale})`, opacity: contextOpacity}}>
          <PurchaseReceipt />
        </div>

        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: contextOpacity}}>
          {/* A neutral item-divider branch identifies suppliers; money starts at Apple. */}
          <path
            d={`M${806.4 + 48 * 0.48} ${56 + RECEIPT_LAYOUT.itemDividerY * 0.48} H${CHAIN_X} V${rowY(0)}`}
            fill="none" stroke={color.fgDim} strokeWidth={1.5}
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - branchIn} opacity={0.45}
          />
          {SUPPLIERS.map((supplier, i) => {
            const endY = i === SUPPLIERS.length - 1 ? 908 : rowY(i + 1);
            const startAt = dur * rowReadyAt(i);
            const endAt = i === SUPPLIERS.length - 1 ? dur * 0.78 : dur * rowReadyAt(i + 1);
            const reveal = interpolate(frame, [startAt, endAt], [0, 1], CLAMP);
            return <line key={supplier.label} x1={CHAIN_X} x2={CHAIN_X} y1={rowY(i)} y2={rowY(i) + (endY - rowY(i)) * reveal} stroke={color.money} strokeWidth={2} opacity={0.55} />;
          })}
        </svg>

        <div style={{position: 'absolute', left: 800, top: 354, fontSize: type.cardBody, color: color.fgDim, opacity: headerIn * contextOpacity}}>
          Supplier payments
        </div>
        {SUPPLIERS.map((supplier, i) => {
          // Fade and cubic ease-out finish when the coin/connector reaches this row.
          const rowIn = interpolate(frame, [dur * rowAt(i), dur * rowReadyAt(i)], [0, 1], CLAMP);
          const rowOffset = 24 * (1 - rowIn) ** 3;
          return (
            <div key={supplier.label} style={{position: 'absolute', left: CHAIN_X - 26, top: rowY(i) - 26, height: 52, display: 'flex', alignItems: 'center', gap: 24, opacity: rowIn * contextOpacity, transform: `translateY(${rowOffset}px)`}}>
              <div style={{width: 52, height: 52, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', overflow: 'hidden', background: supplier.logo ? color.bgInner : undefined}}>
                {supplier.logo && (
                  <div style={{
                    width: supplier.logo === 'apple' ? 26 : 40, height: 30, background: color.fg,
                    maskImage: `url("${staticFile(`logos/${supplier.logo}.svg`)}")`,
                    maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat',
                    WebkitMaskImage: `url("${staticFile(`logos/${supplier.logo}.svg`)}")`,
                    WebkitMaskSize: 'contain', WebkitMaskPosition: 'center', WebkitMaskRepeat: 'no-repeat',
                  }} />
                )}
              </div>
              <span style={{fontSize: type.closeBody, fontWeight: 450}}>{supplier.label}</span>
            </div>
          );
        })}

        <svg width={40} height={40} viewBox="0 0 40 40" style={{position: 'absolute', left: coinX - 20, top: coinY - 20, opacity: coinOpacity}}>
          <circle cx={20} cy={20} r={15} fill={color.bgOuter} stroke={color.money} strokeWidth={2} />
          <text x={20} y={26} textAnchor="middle" fill={color.money} fontFamily={font.family} fontSize={18}>$</text>
          <rect x={25} y={3} width={12} height={12} rx={2} fill={color.amber} />
          <path d="M28 6v3h6M31 9v3" fill="none" stroke={color.bgOuter} strokeWidth={1.5} />
        </svg>
        <div style={{position: 'absolute', left: CHAIN_X - 90 * 0.78 / 2, top: 908, opacity: markIn, transform: `translateY(${12 * (1 - markIn)}px)`}}>
          <Wordmark size={90} full />
        </div>
      </div>
    </AbsoluteFill>
  );
};
