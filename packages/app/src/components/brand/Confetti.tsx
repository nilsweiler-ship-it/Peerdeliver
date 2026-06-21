import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

const DOTS = [
  { top: '8%', left: '12%', c: colors.signal, s: 8, r: '20deg' },
  { top: '14%', left: '78%', c: colors.impactLeaf, s: 10, r: '-15deg' },
  { top: '22%', left: '40%', c: '#FFFFFF', s: 6, r: '10deg' },
  { top: '30%', left: '88%', c: colors.signal, s: 7, r: '40deg' },
  { top: '34%', left: '8%', c: colors.impactLeaf, s: 9, r: '-30deg' },
  { top: '46%', left: '70%', c: '#FFFFFF', s: 6, r: '0deg' },
  { top: '52%', left: '20%', c: colors.signal, s: 8, r: '25deg' },
  { top: '60%', left: '90%', c: colors.impactLeaf, s: 7, r: '-20deg' },
  { top: '12%', left: '55%', c: colors.signal, s: 6, r: '15deg' },
  { top: '40%', left: '30%', c: '#FFFFFF', s: 7, r: '-10deg' },
] as const;

/** Scattered celebration confetti dots (marigold / leaf / white). */
export function Confetti() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DOTS.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: d.top as any,
            left: d.left as any,
            width: d.s,
            height: d.s,
            borderRadius: 2,
            backgroundColor: d.c,
            transform: [{ rotate: d.r }],
            opacity: 0.9,
          }}
        />
      ))}
    </View>
  );
}
