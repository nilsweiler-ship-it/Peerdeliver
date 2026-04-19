import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNearbyDeliveries, useAssignDelivery } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { EmptyState, LoadingSpinner, Modal, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import type { DeliveryRequest } from '@peerdeliver/shared';
import { PACKAGE_SIZES } from '@peerdeliver/shared';

export function AvailableDeliveriesScreen() {
  const { t } = useTranslation();
  // Default to Zurich center for demo — in production, use driver's first route origin
  const { data: deliveries, isLoading, refetch, isRefetching } = useNearbyDeliveries({
    lat: 47.3769,
    lng: 8.5417,
    radius: 100,
  });
  const assignDelivery = useAssignDelivery();
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRequest | null>(null);

  const handleAccept = async (delivery: DeliveryRequest) => {
    try {
      await assignDelivery.mutateAsync(delivery.id);
      Alert.alert(t('driver.requestSuccess'));
      setSelectedDelivery(null);
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: DeliveryRequest }) => (
      <DeliveryCard delivery={item} onPress={() => setSelectedDelivery(item)} />
    ),
    [],
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="📍"
            title={t('driver.noDeliveries')}
            message={t('driver.noDeliveriesMessage')}
          />
        }
      />

      {/* Delivery detail modal */}
      <Modal
        visible={!!selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
        title={selectedDelivery?.packageDescription || t('driver.availableDeliveries')}
      >
        {selectedDelivery && (
          <View style={styles.detail}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.pickup')}</Text>
              <Text style={styles.detailValue}>{selectedDelivery.pickupAddress.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.delivery')}</Text>
              <Text style={styles.detailValue}>{selectedDelivery.deliveryAddress.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.packageSize')}</Text>
              <Text style={styles.detailValue}>
                {PACKAGE_SIZES[selectedDelivery.packageSize].label}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.budget')}</Text>
              <Text style={styles.detailValue}>CHF {selectedDelivery.budgetCHF.toFixed(0)}</Text>
            </View>
            {(selectedDelivery as any).distanceKm != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>
                  {((selectedDelivery as any).distanceKm as number).toFixed(1)} km
                </Text>
              </View>
            )}
            {(selectedDelivery as any).sender && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('driver.senderRating')}</Text>
                <Text style={styles.detailValue}>
                  {(selectedDelivery as any).sender.averageRating
                    ? `${(selectedDelivery as any).sender.averageRating.toFixed(1)} (${(selectedDelivery as any).sender.totalRatings})`
                    : 'N/A'}
                </Text>
              </View>
            )}
            <Button
              title={t('driver.requestDelivery')}
              onPress={() => handleAccept(selectedDelivery)}
              loading={assignDelivery.isPending}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  detail: { gap: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});
