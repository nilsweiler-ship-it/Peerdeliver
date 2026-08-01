import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LeafMark } from './LeafMark';
import { RouteWatermark } from './RouteWatermark';
import { colors, typography, spacing, borderRadius, shadow } from '../../theme';

interface ImpactCardProps {
  /** e.g. "23.4 kg" — rendered in mono. */
  amount: string;
  /** Main caption, e.g. "CO₂ saved this year". */
  caption: string;
  /** Optional secondary line, e.g. "≈ 14 car trips never made". */
  sub?: string;
  /** light card on paper, or hero gradient-on-dark. */
  variant?: 'light' | 'dark';
  amountSize?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Reusable carbon-impact panel — the recurring "green means impact" element. */
export function ImpactCard({
  amount,
  caption,
  sub,
  variant = 'light',
  amountSize = 23,
  onPress,
  style,
}: ImpactCardProps) {
  const dark = variant === 'dark';
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.card,
        dark ? styles.cardDark : styles.cardLight,
        style,
      ]}
    >
      {dark && <RouteWatermark size={180} opacity={0.08} style={{ right: -30, top: -20 }} />}
      <View style={[styles.iconWrap, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.surface }]}>
        <LeafMark size={20} color={dark ? colors.impactLeaf : colors.impact} />
      </View>
      <View style={styles.body}>
        <Text
          style={[
            styles.amount,
            {
              fontSize: amountSize,
              // typography.figure ships a fixed lineHeight of 22 for its 19px
              // size. Overriding fontSize without it clipped the glyphs — the
              // "kg" descender and the CO₂ subscript were cut off at the
              // default 23. Scale the box with the text instead.
              lineHeight: Math.round(amountSize * 1.25),
              color: dark ? colors.impactOnDark : colors.impact,
            },
          ]}
        >
          {amount}
        </Text>
        <Text style={[styles.caption, { color: dark ? colors.textInverse : colors.text }]}>{caption}</Text>
        {!!sub && (
          <Text style={[styles.sub, { color: dark ? 'rgba(255,255,255,0.62)' : colors.textSecondary }]}>{sub}</Text>
        )}
      </View>
      {onPress && !dark && <Feather name="chevron-right" size={20} color={colors.impact} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    overflow: 'hidden',
  },
  cardLight: {
    backgroundColor: colors.impactSurface,
    borderWidth: 1,
    borderColor: colors.impactSurfaceBorder,
  },
  cardDark: {
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  amount: {
    ...typography.figure,
  },
  caption: {
    ...typography.bodyStrong,
    marginTop: 1,
  },
  sub: {
    ...typography.caption,
    marginTop: 2,
  },
});
