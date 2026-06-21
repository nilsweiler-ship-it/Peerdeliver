import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { colors, typography, borderRadius, spacing, shadow } from '../../theme';

interface TicketStubProps {
  title: string;
  /** Show a lock icon in the header (delivery code). */
  locked?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Footer slot below the perforation (e.g. a confirm button). */
  footer?: React.ReactNode;
}

/** Postal ticket-stub: marigold header, perforated cut line with side notches. */
export function TicketStub({ title, locked, children, footer, style }: TicketStubProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{title}</Text>
        {locked && <Feather name="lock" size={14} color={colors.signalText} />}
      </View>

      {/* perforation */}
      <View style={styles.perfRow}>
        <View style={[styles.notch, styles.notchLeft]} />
        <Svg height={2} width={9999} style={styles.cut}>
          <Line x1={0} y1={1} x2={9999} y2={1} stroke={colors.routeDash} strokeWidth={2} strokeDasharray="4 4" />
        </Svg>
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.body}>{children}</View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const NOTCH = 18;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.signalSoft,
    paddingVertical: 10,
  },
  headerText: {
    ...typography.overline,
    color: colors.signalText,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: NOTCH,
  },
  cut: {
    flex: 1,
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: colors.background,
  },
  notchLeft: {
    marginLeft: -NOTCH / 2,
  },
  notchRight: {
    marginRight: -NOTCH / 2,
  },
  body: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
