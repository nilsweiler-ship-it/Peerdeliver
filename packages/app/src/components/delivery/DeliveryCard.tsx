import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Badge, getStatusVariant } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
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
  const statusLabel = delivery.status.replace('_', ' ').toUpperCase();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Badge label={statusLabel} variant={getStatusVariant(delivery.status)} />
          <Text style={styles.price}>CHF {delivery.budgetCHF.toFixed(0)}</Text>
        </View>

        <View style={styles.route}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.address} numberOfLines={1}>
              {delivery.pickupAddress.label}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.dot, styles.dotRed]} />
            <Text style={styles.address} numberOfLines={1}>
              {delivery.deliveryAddress.label}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.meta}>
            {sizeInfo.label} · {delivery.packageDescription || t('sender.packageSize')}
          </Text>
          {delivery.driver && (
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
    marginBottom: spacing.sm,
  },
  price: {
    ...typography.h3,
    color: colors.primary,
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
