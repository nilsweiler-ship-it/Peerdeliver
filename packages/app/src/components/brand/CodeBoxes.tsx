import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';

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
    gap: spacing.sm,
    justifyContent: 'center',
    // A definite width, whatever the parent's alignItems: with only
    // alignSelf:'stretch' a centring parent gave the row no width and the
    // flexible boxes collapsed to slivers.
    width: '100%',
    maxWidth: 44 * 6 + 8 * 5,
  },
  // Flexible up to 44 px: six fixed 44 px boxes plus gaps overflowed the
  // driver's code card at phone width and clipped the sixth digit.
  box: {
    flex: 1,
    maxWidth: 44,
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
