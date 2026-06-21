import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius } from '../../theme';

interface CodeBoxesProps {
  /** Current entered value (0–length chars). */
  value: string;
  length?: number;
  /** Highlight the next-to-fill box with a marigold border. */
  showActive?: boolean;
}

/** Six "postal" code boxes — filled values in mono, active box marigold. */
export function CodeBoxes({ value, length = 6, showActive = true }: CodeBoxesProps) {
  const chars = value.split('');
  const activeIdx = chars.length;
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const filled = i < chars.length;
        const active = showActive && i === activeIdx && activeIdx < length;
        return (
          <View key={i} style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}>
            <Text style={styles.char}>{chars[i] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  box: {
    width: 44,
    height: 54,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  boxActive: {
    borderColor: colors.signal,
    borderWidth: 2,
    backgroundColor: colors.signalSoft,
  },
  char: {
    ...typography.code,
    color: colors.text,
    letterSpacing: 0,
  },
});
