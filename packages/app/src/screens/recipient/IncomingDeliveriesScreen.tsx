import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { StatusTimeline } from '../../components/delivery/StatusTimeline';
import { EmptyState, LoadingSpinner, Modal } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { DeliveryRequest } from '@peerdeliver/shared';

export function IncomingDeliveriesScreen() {
  const { t } = useTranslation();
  const { data: deliveries, isLoading, refetch, isRefetching } = useMyDeliveries();
  const [selected, setSelected] = useState<DeliveryRequest | null>(null);

  const renderItem = useCallback(
    ({ item }: { item: DeliveryRequest }) => (
      <DeliveryCard delivery={item} onPress={() => setSelected(item)} />
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
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📥"
            title={t('recipient.noIncoming')}
            message={t('recipient.noIncomingMessage')}
          />
        }
      />

      <Modal
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.packageDescription || t('recipient.incomingDeliveries')}
      >
        {selected && (
          <View style={styles.detail}>
            <StatusTimeline currentStatus={selected.status} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.pickup')}</Text>
              <Text style={styles.detailValue}>{selected.pickupAddress.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sender.delivery')}</Text>
              <Text style={styles.detailValue}>{selected.deliveryAddress.label}</Text>
            </View>

            {selected.sender && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recipient.sender')}</Text>
                <Text style={styles.detailValue}>
                  {selected.sender.firstName} {selected.sender.lastName}
                </Text>
              </View>
            )}

            {selected.driver && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('sender.searchDrivers')}</Text>
                <Text style={styles.detailValue}>
                  {selected.driver.firstName} {selected.driver.lastName}
                </Text>
              </View>
            )}

            {/* Recipients hold the delivery code and show it to the driver to
                confirm receipt. It only becomes relevant once in transit. */}
            {selected.status === 'in_transit' && selected.deliveryCode ? (
              <View style={styles.codeCard}>
                <Text style={styles.codeTitle}>{t('recipient.deliveryCodeTitle')}</Text>
                <Text style={styles.codeValue}>{selected.deliveryCode}</Text>
                <Text style={styles.codeHint}>{t('recipient.deliveryCodeHint')}</Text>
              </View>
            ) : (
              selected.status !== 'delivered' &&
              selected.status !== 'cancelled' && (
                <Text style={styles.codeWaiting}>
                  {t('recipient.codeAvailableWhenInTransit')}
                </Text>
              )
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  detail: { gap: spacing.md, paddingTop: spacing.md },
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
  codeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  codeTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  codeValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 8,
    marginBottom: spacing.xs,
  },
  codeHint: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  codeWaiting: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
