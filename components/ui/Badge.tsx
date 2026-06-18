import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: '#E7EDE7', text: '#1F6F49' },
  warning: { bg: colors.signalSoft, text: colors.signalText },
  error: { bg: '#F6E2D8', text: '#9A4424' },
  info: { bg: '#EAF0F4', text: '#2D6F94' },
  neutral: { bg: colors.surfaceSunken, text: colors.textSecondary },
};

const statusVariantMap: Record<string, BadgeVariant> = {
  pending: 'warning',
  matched: 'info',
  accepted: 'info',
  picked_up: 'info',
  in_transit: 'info',
  delivered: 'success',
  cancelled: 'error',
  expired: 'neutral',
};

export function getStatusVariant(status: string): BadgeVariant {
  return statusVariantMap[status] || 'neutral';
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const colorSet = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: colorSet.bg }, style]}>
      <Text style={[styles.label, { color: colorSet.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.overline,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
