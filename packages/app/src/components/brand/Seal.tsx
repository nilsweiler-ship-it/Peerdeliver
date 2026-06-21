import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '../../theme';

interface SealProps {
  size?: number;
  color?: string;
}

/** Postmark seal — circular dashed stamp with the route motif inside. */
export function Seal({ size = 44, color = colors.signal }: SealProps) {
  const c = size / 2;
  const r = c - 2;
  const ox = c - r * 0.42;
  const dx = c + r * 0.42;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />
      <Circle cx={c} cy={c} r={r - 4} stroke={color} strokeWidth={1} opacity={0.5} />
      {/* route motif inside */}
      <Line x1={ox} y1={c} x2={dx} y2={c} stroke={color} strokeWidth={1.4} strokeDasharray="2 2.5" />
      <Circle cx={ox} cy={c} r={2.4} fill={color} />
      <Circle cx={dx} cy={c} r={2.4} stroke={color} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}
