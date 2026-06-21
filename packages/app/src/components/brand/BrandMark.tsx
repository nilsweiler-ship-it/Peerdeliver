import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, typography } from '../../theme';

interface BrandMarkProps {
  /** Light mark for dark surfaces. */
  onDark?: boolean;
  showWordmark?: boolean;
  size?: number;
}

/** The Shlep / PeerDeliver brand mark: route motif glyph + wordmark. */
export function BrandMark({ onDark = false, showWordmark = true, size = 28 }: BrandMarkProps) {
  const origin = onDark ? colors.impactLeaf : colors.primaryLight;
  const dest = colors.destination;
  const dash = onDark ? 'rgba(255,255,255,0.55)' : colors.routeDash;
  const word = onDark ? colors.textInverse : colors.text;
  const w = size * 1.6;
  return (
    <View style={styles.row}>
      <Svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} fill="none">
        <Line x1={size * 0.28} y1={size / 2} x2={w - size * 0.28} y2={size / 2} stroke={dash} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" />
        <Circle cx={size * 0.28} cy={size / 2} r={size * 0.16} fill={origin} />
        <Circle cx={w - size * 0.28} cy={size / 2} r={size * 0.16} stroke={dest} strokeWidth={2.2} fill="none" />
      </Svg>
      {showWordmark && (
        <Text style={[styles.word, { color: word, fontSize: size * 0.74 }]}>Shlep</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  word: {
    ...typography.h2,
  },
});
