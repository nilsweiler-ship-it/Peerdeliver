import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { DeliveryStatus } from '@peerdeliver/shared';

const STATUSES: { key: DeliveryStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'matched', label: 'Matched' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

interface StatusTimelineProps {
  currentStatus: DeliveryStatus;
}

export function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  if (currentStatus === 'cancelled' || currentStatus === 'expired') {
    return (
      <View style={styles.terminalContainer}>
        <View style={[styles.terminalDot, currentStatus === 'cancelled' ? styles.cancelledDot : styles.expiredDot]} />
        <Text style={styles.terminalText}>
          {currentStatus === 'cancelled' ? 'Cancelled' : 'Expired'}
        </Text>
      </View>
    );
  }

  const currentIdx = STATUSES.findIndex((s) => s.key === currentStatus);

  return (
    <View style={styles.container}>
      {STATUSES.map((status, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <View key={status.key} style={styles.step}>
            <View style={styles.indicator}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.completedDot,
                  isCurrent && styles.currentDot,
                ]}
              />
              {idx < STATUSES.length - 1 && (
                <View style={[styles.line, isCompleted && styles.completedLine]} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                isCompleted && styles.completedLabel,
                isCurrent && styles.currentLabel,
              ]}
            >
              {status.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    zIndex: 1,
  },
  completedDot: {
    backgroundColor: colors.primary,
  },
  currentDot: {
    backgroundColor: colors.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  line: {
    position: 'absolute',
    height: 2,
    left: '50%',
    right: '-50%',
    backgroundColor: colors.border,
    zIndex: 0,
  },
  completedLine: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  completedLabel: {
    color: colors.textSecondary,
  },
  currentLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  terminalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  terminalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cancelledDot: {
    backgroundColor: colors.error,
  },
  expiredDot: {
    backgroundColor: colors.textLight,
  },
  terminalText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
