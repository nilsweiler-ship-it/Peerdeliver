import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, statusColors, borderRadius, typography, spacing } from '../../theme';

type StatusKey = keyof typeof statusColors;

interface StatusBadgeProps {
  status: string;
  /** Optional explicit label, otherwise derived from the status key. */
  label?: string;
  /** Show the leading status dot. */
  dot?: boolean;
  style?: ViewStyle;
}

function resolve(status: string) {
  if (status in statusColors) return statusColors[status as StatusKey];
  // Sensible fallbacks for statuses outside the core 4.
  if (status === 'accepted' || status === 'picked_up') return statusColors.matched;
  if (status === 'cancelled' || status === 'expired')
    return { bg: colors.surfaceSunken, fg: colors.textSecondary, dot: colors.textLight };
  return statusColors.pending;
}

export function StatusBadge({ status, label, dot = true, style }: StatusBadgeProps) {
  const c = resolve(status);
  const text = (label ?? status.replace(/_/g, ' ')).toUpperCase();
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.dot }]} />}
      <Text style={[styles.label, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typography.overline,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
