import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {color, font} from '../../brand/tokens';
import {CLAMP} from '../../motion/timing';

// Original 13-node topology; only the affine placement changes for the left column.
const NODES: [number, number][] = [
  [200,540],[420,300],[420,780],[680,180],[680,480],[680,860],
  [960,340],[960,640],[1240,220],[1240,540],[1240,860],[1500,420],[1500,720],
];
const EDGES: [number, number][] = [
  [0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[4,6],[4,7],[5,7],
  [6,8],[6,9],[7,9],[7,10],[9,11],[9,12],[10,12],
];
const LOGOS: Record<number, string> = {0:'apple',1:'tsmc',3:'foxconn',5:'samsung',8:'corning',10:'qualcomm',12:'sony'};
// Optical sizing for wide wordmarks, preserving each SVG's aspect ratio.
const LOGO_WIDTHS: Record<string, number> = {foxconn:136, samsung:136, corning:128};
const COIN_SIZE = 64;
const point = ([x,y]: [number,number]) => [170+(x-200)*0.49, 420+(y-180)*0.78];

/** Compact adaptation of public/icons/dated-dollar.svg's coin and date glyph. */
const DatedDollar: React.FC = () => (
  <svg width={COIN_SIZE} height={COIN_SIZE} viewBox="0 0 210 210">
    <circle cx={100} cy={100} r={78} fill={color.bgInner} stroke={color.money} strokeWidth={7}/>
    <circle cx={100} cy={100} r={69} fill="none" stroke={color.fgDim} strokeWidth={2}/>
    <text x={100} y={111} textAnchor="middle" fontFamily={font.family} fontSize={34} fontWeight={700} fontStyle="italic" fill={color.fg}>USD</text>
    <g transform="translate(168.87 136.62)" fill={color.amber}>
      <rect x={-34} y={-10} width={68} height={20} rx={10}/>
      <rect x={-10} y={-34} width={20} height={68} rx={10}/>
    </g>
  </svg>
);

/** Wave order and topology match ending A; normalize the final edge to finish at one. */
export const PaymentNetwork: React.FC<{drawProgress: number}> = ({drawProgress}) => (
  <>
      <svg width={1920} height={1080} style={{position:'absolute',inset:0}}>
        {EDGES.map(([a,b],i)=>{
          const [x1,y1]=point(NODES[a]),[x2,y2]=point(NODES[b]);
          const len=Math.hypot(x2-x1,y2-y1);
          const p=Math.max(0,Math.min(1,(drawProgress * (0.35 + ((EDGES.length - 1) / EDGES.length) * 0.7) - (i / EDGES.length) * 0.7) / 0.35));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color.money} strokeWidth={2} strokeOpacity={0.65} strokeDasharray={len} strokeDashoffset={len*(1-p)}/>;
        })}
      </svg>
      {NODES.map((node,i)=>{
        const [x,y]=point(node);
        const logo = LOGOS[i];
        const logoWidth = LOGO_WIDTHS[logo] ?? 104;
        const nodeWidth = logo ? Math.max(132, logoWidth+20) : 132;
        const nodeHeight = logo ? 58 : COIN_SIZE;
        const opacity=interpolate(drawProgress,[(i/NODES.length)*0.6,(i/NODES.length)*0.6+0.08],[0,1],CLAMP);
        return <div key={i} style={{position:'absolute',left:x-nodeWidth/2,top:y-nodeHeight/2,width:nodeWidth,height:nodeHeight,display:'grid',placeItems:'center',background:color.bgOuter,borderRadius:16,opacity}}>
          {logo ? <Img src={staticFile(`logos/${logo}.svg`)} style={{width:logoWidth,height:38,objectFit:'contain',filter:'brightness(0) invert(1)',opacity:0.85}}/> : <DatedDollar/>}
        </div>;
      })}
  </>
);
