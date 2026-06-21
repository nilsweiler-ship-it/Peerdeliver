import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { RouteLine } from '../brand/RouteLine';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { PACKAGE_SIZES } from '@peerdeliver/shared';
import type { DriverRoute } from '@peerdeliver/shared';

interface RouteCardProps {
  route: DriverRoute;
  onPress?: () => void;
  showDriver?: boolean;
}

export function RouteCard({ route, onPress, showDriver = false }: RouteCardProps) {
  const sizeInfo = PACKAGE_SIZES[route.availableSize];
  const departureDate = new Date(route.departureTime);
  const formattedDate = departureDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = departureDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          {route.isActive ? (
            <Badge label="ACTIVE" variant="success" />
          ) : (
            <Badge label="INACTIVE" variant="neutral" />
          )}
          <Badge
            label={route.routeType === 'recurring' ? 'RECURRING' : 'ONE-TIME'}
            variant="info"
          />
        </View>

        <RouteLine
          from={route.originAddress}
          to={route.destinationAddress}
          variant="horizontal"
          style={styles.route}
        />

        <View style={styles.divider} />

        <View style={styles.footer}>
          <Text style={styles.meta}>
            {formattedDate} · <Text style={styles.metaMono}>{formattedTime}</Text>
          </Text>
          <Text style={styles.meta}>{sizeInfo.label}</Text>
        </View>

        {showDriver && route.driver && (
          <View style={styles.driverRow}>
            <Avatar
              firstName={route.driver.firstName}
              lastName={route.driver.lastName}
              uri={route.driver.avatarUrl}
              size={28}
            />
            <Text style={styles.driverName}>
              {route.driver.firstName} {route.driver.lastName?.charAt(0)}.
            </Text>
          </View>
        )}

        {route.recurringDays && route.recurringDays.length > 0 && (
          <View style={styles.daysRow}>
            {route.recurringDays.map((day) => (
              <View key={day} style={styles.dayBadge}>
                <Text style={styles.dayText}>{day}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  route: {
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaMono: {
    fontFamily: typography.figure.fontFamily,
    color: colors.text,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  driverName: {
    ...typography.bodySmall,
    color: colors.text,
  },
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  dayBadge: {
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  dayText: {
    ...typography.overline,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
});
