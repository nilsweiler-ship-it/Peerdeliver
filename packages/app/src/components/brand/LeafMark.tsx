import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

interface LeafMarkProps {
  size?: number;
  color?: string;
}

/** The carbon-savings leaf. Single-stroke organic leaf with a center vein. */
export function LeafMark({ size = 18, color = colors.impact }: LeafMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 4C20 4 9 4 6 9c-2.4 4-1 9 1 11 2 2 7 3.4 11 1 5-3 5-17 5-17z"
        fill={color}
      />
      <Path
        d="M7.5 18.5C9.5 13 13 9.5 18 7.5"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.85}
      />
    </Svg>
  );
}
