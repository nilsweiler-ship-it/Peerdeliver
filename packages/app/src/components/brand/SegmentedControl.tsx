import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, typography, borderRadius, shadow } from '../../theme';

export interface Segment {
  key: string;
  label: string;
  /** Optional trailing count, e.g. "2" → "Active 2". */
  count?: number | string;
}

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}

/** Track in surfaceSunken, active segment a raised white card. */
export function SegmentedControl({ segments, value, onChange, style }: SegmentedControlProps) {
  return (
    <View style={[styles.track, style]}>
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <TouchableOpacity
            key={s.key}
            activeOpacity={0.8}
            onPress={() => onChange(s.key)}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {s.label}
              {s.count !== undefined && <Text style={styles.count}>  {s.count}</Text>}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.lg,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.md,
  },
  segActive: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.text,
  },
  count: {
    ...typography.figure,
    fontSize: 13,
    color: colors.textLight,
  },
});
