import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, typography, borderRadius } from '../../theme';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface DayPickerProps {
  /** Selected day keys (mon..sun). */
  value: string[];
  onChange: (days: string[]) => void;
  style?: ViewStyle;
}

/** Seven square day toggles — selected spruce, off white. */
export function DayPicker({ value, onChange, style }: DayPickerProps) {
  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter((d) => d !== key) : [...value, key]);
  };
  return (
    <View style={[styles.row, style]}>
      {DAYS.map((d, i) => {
        const key = KEYS[i];
        const on = value.includes(key);
        return (
          <TouchableOpacity
            key={key}
            activeOpacity={0.8}
            onPress={() => toggle(key)}
            style={[styles.cell, on && styles.cellOn]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{d}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 7,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  textOn: {
    color: colors.textInverse,
  },
});
