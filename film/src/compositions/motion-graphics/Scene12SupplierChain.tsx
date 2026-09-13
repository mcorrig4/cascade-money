import React from 'react';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, font, type} from '../../brand/tokens';
import {Wordmark} from '../../components/Wordmark';
import {CLAMP} from '../../motion/timing';
import {PurchaseReceipt, RECEIPT_LAYOUT, ReceiptPhone} from './Scene11Receipt';

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

const RECEIPT_FINAL_SCALE = 0.48;
const RECEIPT_FINAL_TOP = 56;
const CHAIN_X = RECEIPT_LAYOUT.left + RECEIPT_LAYOUT.width * RECEIPT_FINAL_SCALE + 32;
// Clears the 26px badge radius plus the coin's 20px bounding-box radius.
const COIN_TRACK_X = CHAIN_X - 48;
const rowY = (index: number) => 400 + index * 60;
const rowAt = (index: number) => 0.18 + (index * 0.5) / (SUPPLIERS.length - 1);
const rowReadyAt = (index: number) => rowAt(index) + 0.025;

/** Scene 12 — the purchase's suppliers, then the payment rail underneath them. */
export const Scene12SupplierChain: React.FC<{
  durationInFrames: number;
  previousSceneDurationInFrames: number;
}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  // Reserve one second each for the centered hold and the final black screen.
  // Keep rounded cues strictly ordered, reserving room for every remaining phase.
  // Sub-frame spacing also supports scenes shorter than the seven closing phases.
  const h = fps / dur;
  const a = 1 - 2 * h;
  const boundary = (fraction: number) => Math.round(dur * fraction);
  const preferredBoundaries = [
    boundary(0.50 * a),
    boundary(0.58 * a),
    boundary(0.68 * a),
    boundary(0.90 * a),
    boundary(0.90 * a) + Math.round(fps),
    dur - Math.round(fps),
    dur,
  ];
  const minimumGap = Math.min(1, dur / preferredBoundaries.length);
  let previousBoundary = 0;
  const [contextFadeStart, contextFadeEnd, markFadeInEnd, markMoveEnd, markHoldEnd, blackStart] = preferredBoundaries.map((preferred, index) => {
    const latest = dur - (preferredBoundaries.length - 1 - index) * minimumGap;
    const next = Math.min(latest, Math.max(previousBoundary + minimumGap, preferred));
    previousBoundary = next;
    return next;
  });
  // The original supplier choreography finishes at 84% of its local timeline.
  const supplierDur = contextFadeStart / 0.84;
  const move = interpolate(frame, [0, supplierDur * 0.16], [0, 1], CLAMP);
  const receiptScale = 1 - move * 0.52;
  const receiptLeft = RECEIPT_LAYOUT.left;
  const receiptTop = RECEIPT_LAYOUT.top + (RECEIPT_FINAL_TOP - RECEIPT_LAYOUT.top) * move;
  const blackOpacity = interpolate(frame, [contextFadeStart, contextFadeEnd], [0, 1], CLAMP);
  const markOpacity = interpolate(
    frame, [contextFadeEnd, markFadeInEnd, markHoldEnd, blackStart], [0, 1, 1, 0], CLAMP,
  );
  const markY = interpolate(frame, [markFadeInEnd, markMoveEnd], [height * 0.86, height * 0.5], {
    ...CLAMP, easing: Easing.inOut(Easing.cubic),
  });
  const headerIn = interpolate(frame, [supplierDur * 0.16, supplierDur * rowReadyAt(0)], [0, 1], CLAMP);
  const coinY = interpolate(
    frame,
    [...SUPPLIERS.map((_, i) => supplierDur * rowReadyAt(i)), supplierDur * 0.8],
    [...SUPPLIERS.map((_, i) => rowY(i)), 943],
    CLAMP,
  );
  // Stay beside every supplier; converge only after clearing the final row.
  const coinX = interpolate(coinY, [rowY(SUPPLIERS.length - 1) + 52, 943], [COIN_TRACK_X, CHAIN_X], CLAMP);
  const coinOpacity = interpolate(frame, [supplierDur * rowAt(0), supplierDur * rowReadyAt(0), supplierDur * 0.78, supplierDur * 0.84], [0, 1, 1, 0], CLAMP);
  const branchIn = interpolate(frame, [supplierDur * 0.16, supplierDur * rowReadyAt(0)], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{background: color.bgOuter, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1920, height: 1080, fontFamily: font.family, color: color.fg, transformOrigin: 'top left', transform: `scale(${width / 1920}, ${height / 1080})`}}>
        <ReceiptPhone style={{opacity: 1 - 0.70 * move}} />
        <div style={{position: 'absolute', left: receiptLeft, top: receiptTop, transformOrigin: 'top left', transform: `scale(${receiptScale})`}}>
          <PurchaseReceipt />
        </div>

        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          {/* A neutral item-divider branch identifies suppliers; money starts at Apple. */}
          <path
            d={`M${RECEIPT_LAYOUT.left + (RECEIPT_LAYOUT.width - 48) * RECEIPT_FINAL_SCALE} ${RECEIPT_FINAL_TOP + RECEIPT_LAYOUT.itemDividerY * RECEIPT_FINAL_SCALE} H${CHAIN_X} V${rowY(0)}`}
            fill="none" stroke={color.fgDim} strokeWidth={1.5}
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - branchIn} opacity={0.45}
          />
          {SUPPLIERS.map((supplier, i) => {
            const endY = i === SUPPLIERS.length - 1 ? 908 : rowY(i + 1);
            const startAt = supplierDur * rowReadyAt(i);
            const endAt = i === SUPPLIERS.length - 1 ? supplierDur * 0.78 : supplierDur * rowReadyAt(i + 1);
            const reveal = interpolate(frame, [startAt, endAt], [0, 1], CLAMP);
            return <line key={supplier.label} x1={CHAIN_X} x2={CHAIN_X} y1={rowY(i)} y2={rowY(i) + (endY - rowY(i)) * reveal} stroke={color.money} strokeWidth={2} opacity={0.55} />;
          })}
        </svg>

        <div style={{position: 'absolute', left: CHAIN_X + 50, top: 354, fontSize: type.cardBody, color: color.fgDim, opacity: headerIn}}>
          Supplier payments
        </div>
        {SUPPLIERS.map((supplier, i) => {
          // Fade and cubic ease-out finish when the coin/connector reaches this row.
          const rowIn = interpolate(frame, [supplierDur * rowAt(i), supplierDur * rowReadyAt(i)], [0, 1], CLAMP);
          const rowOffset = 24 * (1 - rowIn) ** 3;
          return (
            <div key={supplier.label} style={{position: 'absolute', left: CHAIN_X - 26, top: rowY(i) - 26, height: 52, display: 'flex', alignItems: 'center', gap: 24, opacity: rowIn, transform: `translateY(${rowOffset}px)`}}>
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
      </div>
      <AbsoluteFill style={{background: color.black, opacity: blackOpacity}} />
      <div style={{
        position: 'absolute', left: width * 0.5, top: markY,
        width: 'max-content', whiteSpace: 'nowrap', opacity: markOpacity,
        transform: 'translate(-50%, -50%)',
      }}>
        <Wordmark size={150} full />
      </div>
    </AbsoluteFill>
  );
};
