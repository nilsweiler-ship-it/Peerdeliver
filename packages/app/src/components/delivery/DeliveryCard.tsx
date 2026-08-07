import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../brand/StatusBadge';
import { RouteLine } from '../brand/RouteLine';
import { colors, spacing, typography } from '../../theme';
import { useTranslation } from 'react-i18next';
import type { DeliveryRequest } from '@peerdeliver/shared';
import { PACKAGE_SIZES } from '@peerdeliver/shared';

interface DeliveryCardProps {
  delivery: DeliveryRequest;
  onPress?: () => void;
}

export function DeliveryCard({ delivery, onPress }: DeliveryCardProps) {
  const { t } = useTranslation();
  const sizeInfo = PACKAGE_SIZES[delivery.packageSize];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <StatusBadge status={delivery.status} />
          <Text style={styles.price}>CHF {delivery.budgetCHF.toFixed(0)}</Text>
        </View>

        <RouteLine
          from={delivery.pickupAddress.label}
          to={delivery.deliveryAddress.label}
          style={styles.route}
        />

        <View style={styles.divider} />

        <View style={styles.footer}>
          <Text style={styles.meta} numberOfLines={1}>
            {sizeInfo.label} · {delivery.packageDescription || t('sender.packageSize')}
          </Text>
          {/* While a delivery is merely offered or requested, a driver id is
              set but nobody has agreed to anything. Showing their name here
              read as "this person is taking your parcel", which is not yet
              true and could be undone by a single decline. */}
          {delivery.driver && delivery.status !== 'offered' && delivery.status !== 'requested' && (
            <View style={styles.driver}>
              <Avatar
                firstName={delivery.driver.firstName}
                lastName={delivery.driver.lastName}
                uri={delivery.driver.avatarUrl}
                size={24}
              />
              <Text style={styles.driverName}>
                {delivery.driver.firstName} {delivery.driver.lastName?.charAt(0)}.
              </Text>
            </View>
          )}
        </View>
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
  price: {
    ...typography.figure,
    color: colors.text,
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
    gap: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  driver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  driverName: {
    ...typography.caption,
    color: colors.text,
  },
});
