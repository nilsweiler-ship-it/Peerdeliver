import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, borderRadius } from '../../theme';

interface PillProps {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  /** mono renders the label in JetBrains Mono (counts, "1 / 3", radii). */
  mono?: boolean;
  tone?: 'paper' | 'glass' | 'sunken';
  onDark?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Small rounded pill — location chips, "1 / 3" step counters, ETA tags. */
export function Pill({ label, icon, iconColor, mono, tone = 'paper', onDark, onPress, style }: PillProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const bg =
    tone === 'glass' || onDark
      ? 'rgba(255,255,255,0.14)'
      : tone === 'sunken'
      ? colors.surfaceSunken
      : colors.surface;
  const fg = onDark ? colors.textInverse : colors.textSecondary;
  const border = onDark ? 'rgba(255,255,255,0.18)' : colors.border;
  return (
    <Wrapper activeOpacity={0.8} onPress={onPress} style={[styles.pill, { backgroundColor: bg, borderColor: border }, style]}>
      {icon && <Feather name={icon} size={13} color={iconColor ?? fg} />}
      <Text style={[mono ? styles.mono : styles.text, { color: fg }]}>{label}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  mono: {
    ...typography.overline,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
