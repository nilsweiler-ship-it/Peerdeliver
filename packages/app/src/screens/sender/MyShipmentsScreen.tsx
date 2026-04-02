import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { StatusTimeline } from '../../components/delivery/StatusTimeline';
import { EmptyState, LoadingSpinner, Modal } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import type { DeliveryRequest, DeliveryStatus } from '@peerdeliver/shared';

type FilterTab = 'active' | 'completed' | 'all';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'matched', 'accepted', 'picked_up', 'in_transit'];
const COMPLETED_STATUSES: DeliveryStatus[] = ['delivered', 'cancelled', 'expired'];

export function MyShipmentsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { data: deliveries, isLoading, refetch, isRefetching } = useMyDeliveries();
  const [filter, setFilter] = useState<FilterTab>('active');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRequest | null>(null);

  const filtered = deliveries?.filter((d) => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(d.status);
    if (filter === 'completed') return COMPLETED_STATUSES.includes(d.status);
    return true;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'active', label: t('common.active') },
    { key: 'completed', label: t('common.completed') },
    { key: 'all', label: t('common.all') },
  ];

  const renderItem = useCallback(
    ({ item }: { item: DeliveryRequest }) => (
      <DeliveryCard delivery={item} onPress={() => setSelectedDelivery(item)} />
    ),
    [],
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="📦"
            title={t('sender.noShipments')}
            message={t('sender.noShipmentsMessage')}
            actionLabel={t('sender.createFirst')}
            onAction={() => navigation.navigate('CreateRequest')}
          />
        }
      />

      {/* Detail modal */}
      <Modal
        visible={!!selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
        title={selectedDelivery?.packageDescription || t('sender.delivery')}
      >
        {selectedDelivery && (
          <View style={styles.detail}>
            <StatusTimeline currentStatus={selectedDelivery.status} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.pickup')}</Text>
              <Text style={styles.detailValue}>{selectedDelivery.pickupAddress.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.delivery')}</Text>
              <Text style={styles.detailValue}>{selectedDelivery.deliveryAddress.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.budget')}</Text>
              <Text style={styles.detailValue}>CHF {selectedDelivery.budgetCHF.toFixed(0)}</Text>
            </View>
            {selectedDelivery.driver && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('sender.searchDrivers')}</Text>
                <Text style={styles.detailValue}>
                  {selectedDelivery.driver.firstName} {selectedDelivery.driver.lastName}
                </Text>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  list: {
    padding: spacing.md,
    flexGrow: 1,
  },
  detail: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
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
