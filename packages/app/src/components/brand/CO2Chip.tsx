import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LeafMark } from './LeafMark';
import { colors, typography, borderRadius } from '../../theme';

interface CO2ChipProps {
  /** e.g. "23.4 kg CO₂ saved" */
  label: string;
  onDark?: boolean;
  style?: ViewStyle;
}

/** Compact leaf + mono-figure chip signalling carbon savings. */
export function CO2Chip({ label, onDark = false, style }: CO2ChipProps) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: onDark ? 'rgba(127,199,155,0.16)' : colors.impactSurface },
        style,
      ]}
    >
      <LeafMark size={13} color={onDark ? colors.impactLeaf : colors.impact} />
      <Text style={[styles.label, { color: onDark ? colors.impactOnDark : colors.impact }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    fontSize: 12,
  },
});
