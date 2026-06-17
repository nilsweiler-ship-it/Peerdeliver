import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries, useConfirmDelivery, useRejectDriver, useDriverInfo } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { StatusTimeline } from '../../components/delivery/StatusTimeline';
import { EmptyState, LoadingSpinner, Modal, Button } from '../../components/ui';
import { useSocket } from '../../providers/SocketProvider';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { DeliveryRequest, DeliveryStatus } from '@peerdeliver/shared';
import { SOCKET_EVENTS } from '@peerdeliver/shared';

type FilterTab = 'active' | 'completed' | 'all';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'requested', 'matched', 'accepted', 'picked_up', 'in_transit'];
const COMPLETED_STATUSES: DeliveryStatus[] = ['delivered', 'cancelled', 'expired'];

function DriverRatingCard({ deliveryId, onConfirm, onReject, confirming, rejecting }: {
  deliveryId: string;
  onConfirm: () => void;
  onReject: () => void;
  confirming: boolean;
  rejecting: boolean;
}) {
  const { t } = useTranslation();
  const { data: driver, isLoading } = useDriverInfo(deliveryId);

  if (isLoading) return <Text style={styles.loadingText}>{t('common.loading')}</Text>;
  if (!driver) return null;

  const stars = driver.averageRating ? driver.averageRating.toFixed(1) : 'N/A';

  return (
    <View style={styles.driverCard}>
      <Text style={styles.driverCardTitle}>{t('sender.driverRequest')}</Text>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{driver.firstName} {driver.lastName}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingStar}>{stars}</Text>
          <Text style={styles.ratingCount}>({driver.totalRatings} {t('sender.ratings')})</Text>
        </View>
        <Text style={styles.driverDeliveries}>
          {driver.totalDeliveries} {t('sender.completedDeliveries')}
        </Text>
        {driver.carModel && (
          <Text style={styles.driverVehicle}>{driver.carModel}{driver.maxLoadKg ? ` (max ${driver.maxLoadKg} kg)` : ''}</Text>
        )}
      </View>
      <View style={styles.driverActions}>
        <Button
          title={t('sender.rejectDriver')}
          onPress={onReject}
          variant="outline"
          loading={rejecting}
          style={styles.rejectButton}
        />
        <Button
          title={t('sender.confirmDriver')}
          onPress={onConfirm}
          loading={confirming}
          style={styles.confirmButton}
        />
      </View>
    </View>
  );
}

function DriverTracker({ deliveryId }: { deliveryId: string }) {
  const { t } = useTranslation();
  const socket = useSocket();
  const { data: driver } = useDriverInfo(deliveryId);
  const [location, setLocation] = useState<{ lat: number; lng: number; timestamp: string } | null>(null);

  useEffect(() => {
    if (!socket || !driver?.shareLocation) return;

    socket.emit(SOCKET_EVENTS.TRACKING_START, deliveryId);

    const handler = (data: { lat: number; lng: number; timestamp: string }) => {
      setLocation(data);
    };
    socket.on(SOCKET_EVENTS.TRACKING_LOCATION_NEW, handler);

    return () => {
      socket.emit(SOCKET_EVENTS.TRACKING_STOP, deliveryId);
      socket.off(SOCKET_EVENTS.TRACKING_LOCATION_NEW, handler);
    };
  }, [socket, deliveryId, driver?.shareLocation]);

  if (!driver?.shareLocation) return null;

  return (
    <View style={styles.trackerCard}>
      <Text style={styles.trackerTitle}>{t('sender.driverLocation')}</Text>
      {location ? (
        <View>
          <Text style={styles.trackerCoords}>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Text>
          <Text style={styles.trackerTime}>
            {t('sender.lastUpdated')}: {new Date(location.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      ) : (
        <Text style={styles.trackerWaiting}>{t('sender.waitingLocation')}</Text>
      )}
    </View>
  );
}

export function MyShipmentsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { data: deliveries, isLoading, refetch, isRefetching } = useMyDeliveries();
  const [filter, setFilter] = useState<FilterTab>('active');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRequest | null>(null);
  const confirmDelivery = useConfirmDelivery();
  const rejectDriver = useRejectDriver();

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

  const handleConfirm = async (id: string) => {
    try {
      await confirmDelivery.mutateAsync(id);
      Alert.alert(t('sender.driverConfirmed'));
      setSelectedDelivery(null);
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectDriver.mutateAsync(id);
      Alert.alert(t('sender.driverRejected'));
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

            {/* Show driver confirmation card when status is 'requested' */}
            {selectedDelivery.status === 'requested' && (
              <DriverRatingCard
                deliveryId={selectedDelivery.id}
                onConfirm={() => handleConfirm(selectedDelivery.id)}
                onReject={() => handleReject(selectedDelivery.id)}
                confirming={confirmDelivery.isPending}
                rejecting={rejectDriver.isPending}
              />
            )}

            {selectedDelivery.driver && selectedDelivery.status !== 'requested' && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('sender.searchDrivers')}</Text>
                <Text style={styles.detailValue}>
                  {selectedDelivery.driver.firstName} {selectedDelivery.driver.lastName}
                </Text>
              </View>
            )}

            {/* Live driver tracking */}
            {(selectedDelivery.status === 'accepted' || selectedDelivery.status === 'in_transit') && (
              <DriverTracker deliveryId={selectedDelivery.id} />
            )}

            {/* Senders only see the pickup code — the delivery code is held by the
                recipient, who shows it to the driver to confirm receipt. */}
            {selectedDelivery.status === 'accepted' && selectedDelivery.pickupCode && (
              <View style={styles.codeCard}>
                <Text style={styles.codeTitle}>{t('sender.pickupCodeTitle')}</Text>
                <Text style={styles.codeValue}>{selectedDelivery.pickupCode}</Text>
                <Text style={styles.codeHint}>{t('sender.pickupCodeHint')}</Text>
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
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
  },
  driverCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverCardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  driverInfo: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  driverName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingStar: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '700',
  },
  ratingCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  driverDeliveries: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  driverVehicle: {
    ...typography.caption,
    color: colors.primary,
  },
  driverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rejectButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
  trackerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.trust,
    alignItems: 'center',
  },
  trackerTitle: {
    ...typography.bodySmall,
    color: colors.trust,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  trackerCoords: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  trackerTime: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  trackerWaiting: {
    ...typography.caption,
    color: colors.textLight,
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
});
