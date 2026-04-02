import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { colors, spacing, typography } from '../../theme';
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
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

        <View style={styles.route}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.address} numberOfLines={1}>
              {route.originAddress}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.dot, styles.dotRed]} />
            <Text style={styles.address} numberOfLines={1}>
              {route.destinationAddress}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.meta}>
            {formattedDate} · {formattedTime}
          </Text>
          <Text style={styles.meta}>
            {sizeInfo.label} · {sizeInfo.description}
          </Text>
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
    marginBottom: spacing.sm,
  },
  route: {
    marginBottom: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: colors.success,
  },
  dotRed: {
    backgroundColor: colors.accent,
  },
  routeLine: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginLeft: 4,
  },
  address: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dayText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
