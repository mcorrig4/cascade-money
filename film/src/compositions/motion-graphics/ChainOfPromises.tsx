/**
 * Scene 16 — Beneath it. Script-v6-liam.md: "And underneath that product...
 * is an invisible chain of promises between thousands of companies. Cascade
 * lets those promises move. Before the cash does." Composited over the
 * continuing shot-12-cascade hall capture (stage12-directive: "the year's
 * payment graph drawn as a line network fading up behind the stair").
 *
 * A generic node/edge network, drawn in with an SVG stroke-dashoffset
 * reveal — it represents the SHAPE of the payment graph (thousands of
 * companies, edges = payment hops), not a specific dataset, so no figure
 * here needs sourcing beyond that shape claim itself.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {enter} from '../../motion/timing';
import {color, font} from '../../brand/tokens';

// Small hand-placed node graph — deterministic, no randomness (frame-stable).
const NODES: [number, number][] = [
  [200, 540], [420, 300], [420, 780], [680, 180], [680, 480], [680, 860],
  [960, 340], [960, 640], [1240, 220], [1240, 540], [1240, 860], [1500, 420], [1500, 720],
];
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [4, 6], [4, 7], [5, 7],
  [6, 8], [6, 9], [7, 9], [7, 10], [9, 11], [9, 12], [10, 12],
];

// Minor fix (verified issue #3): the underlying shot-12-cascade capture puts
// its "Verify on Arc" CTA + body-text region at bottom-center of frame — the
// same footprint as this scene's own "Before the cash does." caption below.
// Several decorative edges/nodes drew straight through it. Rather than
// hand-tune each edge's path around a region we can't pixel-measure without
// rendering (forbidden on this box), the whole network is masked out of that
// rectangle: nothing decorative draws there, so it never competes with the
// CTA or the caption sitting on top of it. Flagged for a visual QA pass by
// whoever can render — this rectangle is a reasonable-fit estimate, not a
// measured one.
const CTA_MASK_RECT = {x: 560, y: 760, width: 800, height: 320};

export const ChainOfPromises: React.FC<{durationInFrames: number}> = ({durationInFrames: dur}) => {
  const frame = useCurrentFrame();
  const drawEnd = dur * 0.55;
  const lineAt = dur * 0.6;
  const drawProgress = Math.min(1, frame / drawEnd);
  const line = enter(frame, 30, lineAt, 'fade');

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: 0.85}}>
        <defs>
          <mask id="chain-avoid-cta" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
            <rect x={0} y={0} width={1920} height={1080} fill="#fff" />
            <rect
              x={CTA_MASK_RECT.x}
              y={CTA_MASK_RECT.y}
              width={CTA_MASK_RECT.width}
              height={CTA_MASK_RECT.height}
              fill="#000"
            />
          </mask>
        </defs>
        <g mask="url(#chain-avoid-cta)">
        {EDGES.map(([a, b], i) => {
          const [x1, y1] = NODES[a];
          const [x2, y2] = NODES[b];
          const len = Math.hypot(x2 - x1, y2 - y1);
          const edgeStart = (i / EDGES.length) * 0.7;
          const edgeProgress = Math.max(0, Math.min(1, (drawProgress - edgeStart) / 0.35));
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color.money}
              strokeWidth={2}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - edgeProgress)}
            />
          );
        })}
        {NODES.map(([x, y], i) => {
          const nodeAt = (i / NODES.length) * 0.6;
          const visible = drawProgress > nodeAt ? 1 : 0;
          return (
            <circle key={i} cx={x} cy={y} r={7} fill={color.fg} opacity={visible * 0.9} />
          );
        })}
        </g>
      </svg>
      <AbsoluteFill style={{display: 'grid', placeItems: 'end center', paddingBottom: 130}}>
        <div
          style={{
            fontFamily: font.family,
            fontSize: 42,
            fontWeight: 450,
            color: color.fg,
            opacity: line.opacity,
            transform: line.transform,
            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
          }}
        >
          Before the cash does.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
