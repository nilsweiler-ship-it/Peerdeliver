import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';

interface SuccessMedallionProps {
  size?: number;
}

/** Celebration medallion: dashed outer ring → leaf-green disc → check. */
export function SuccessMedallion({ size = 108 }: SuccessMedallionProps) {
  const disc = size * 0.72;
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 2}
          stroke={colors.impactLeaf}
          strokeWidth={2}
          strokeDasharray="4 5"
          fill="none"
        />
      </Svg>
      <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2 }]}>
        <Feather name="check" size={disc * 0.5} color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    backgroundColor: colors.impact,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
