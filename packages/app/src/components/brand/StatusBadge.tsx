import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { statusColors, colors, spacing, typography, borderRadius } from '../../theme';

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
  // Someone reported a problem; support is on it. Amber: needs attention.
  if (status === 'disputed') return { bg: colors.signalSoft, fg: colors.signalText, dot: colors.signal };
  if (status === 'cancelled' || status === 'expired')
    return { bg: colors.surfaceSunken, fg: colors.textSecondary, dot: colors.textLight };
  return statusColors.pending;
}

export function StatusBadge({ status, label, dot = true, style }: StatusBadgeProps) {
  const { t } = useTranslation();
  const c = resolve(status);
  // Translated status name (status.* in the locale files); it showed the raw
  // English key — "IN TRANSIT", "DISPUTED" — in every language.
  const text = (label ?? t(`status.${status}`, { defaultValue: status.replace(/_/g, ' ') })).toUpperCase();
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
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.sm,
  },
  label: {
    ...typography.overline,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
