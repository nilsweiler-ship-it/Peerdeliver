import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { DeliveryStatus } from '@peerdeliver/shared';

const STATUSES: { key: DeliveryStatus; label: string }[] = [
  { key: 'matched', label: 'Matched' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'delivered', label: 'Delivered' },
];

interface StatusTimelineProps {
  currentStatus: DeliveryStatus;
  orientation?: 'horizontal' | 'vertical';
}

export function StatusTimeline({ currentStatus, orientation = 'horizontal' }: StatusTimelineProps) {
  if (currentStatus === 'cancelled' || currentStatus === 'expired') {
    return (
      <View style={styles.terminalContainer}>
        <View
          style={[
            styles.terminalDot,
            currentStatus === 'cancelled' ? styles.cancelledDot : styles.expiredDot,
          ]}
        />
        <Text style={styles.terminalText}>
          {currentStatus === 'cancelled' ? 'Cancelled' : 'Expired'}
        </Text>
      </View>
    );
  }

  // Map early statuses (pending/requested) onto the first node.
  let currentIdx = STATUSES.findIndex((s) => s.key === currentStatus);
  if (currentIdx === -1) currentIdx = 0;

  if (orientation === 'vertical') {
    return (
      <View>
        {STATUSES.map((status, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const active = isCompleted || isCurrent;
          return (
            <View key={status.key} style={styles.vStep}>
              <View style={styles.vRail}>
                {isCurrent ? (
                  <View style={styles.halo}>
                    <View style={styles.currentDot} />
                  </View>
                ) : (
                  <View style={[styles.dot, isCompleted && styles.completedDot]} />
                )}
                {idx < STATUSES.length - 1 && (
                  <View style={[styles.vLine, isCompleted && styles.completedLine]} />
                )}
              </View>
              <Text
                style={[
                  styles.vLabel,
                  active && styles.completedLabel,
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

  return (
    <View style={styles.container}>
      {STATUSES.map((status, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <View key={status.key} style={styles.step}>
            <View style={styles.indicator}>
              <View style={[styles.dot, isCompleted && styles.completedDot, isCurrent && styles.currentDot]} />
              {idx < STATUSES.length - 1 && (
                <View style={[styles.line, isCompleted && styles.completedLine]} />
              )}
            </View>
            <Text
              style={[styles.label, isCompleted && styles.completedLabel, isCurrent && styles.currentLabel]}
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
    backgroundColor: colors.signal,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  halo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.signalSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
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
    color: colors.text,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  // vertical
  vStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  vRail: {
    alignItems: 'center',
    width: 26,
  },
  vLine: {
    width: 2,
    flex: 1,
    minHeight: 22,
    backgroundColor: colors.border,
    marginVertical: 3,
  },
  vLabel: {
    ...typography.body,
    color: colors.textLight,
    paddingBottom: spacing.md,
    paddingTop: 2,
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
    color: colors.textSecondary,
    fontFamily: typography.bodyStrong.fontFamily,
  },
});
