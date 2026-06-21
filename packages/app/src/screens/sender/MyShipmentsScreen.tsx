import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries, useConfirmDelivery, useRejectDriver, useDriverInfo } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { EmptyState, LoadingSpinner, Modal, Button } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { MapHeader, RouteLine, StatusBadge, Pill, SegmentedControl } from '../../components/brand';
import { useSocket } from '../../providers/SocketProvider';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';
import type { DeliveryRequest, DeliveryStatus } from '@peerdeliver/shared';
import { SOCKET_EVENTS } from '@peerdeliver/shared';

type FilterTab = 'active' | 'completed' | 'all';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'requested', 'matched', 'accepted', 'picked_up', 'in_transit'];
const COMPLETED_STATUSES: DeliveryStatus[] = ['delivered', 'cancelled', 'expired'];

// 3-step mini progress nodes shown in the Track view.
const PROGRESS_STEPS: { label: string; reaches: DeliveryStatus[] }[] = [
  { label: 'Picked up', reaches: ['picked_up', 'in_transit', 'delivered'] },
  { label: 'In transit', reaches: ['in_transit', 'delivered'] },
  { label: 'Delivered', reaches: ['delivered'] },
];

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
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestBadge}>
          <Text style={styles.requestBadgeText}>{t('sender.driverRequest')}</Text>
        </View>
      </View>

      <View style={styles.requestDriverRow}>
        <Avatar firstName={driver.firstName} lastName={driver.lastName} uri={driver.avatarUrl} size={44} />
        <View style={styles.flex}>
          <Text style={styles.requestDriverName}>
            {driver.firstName} {driver.lastName}
          </Text>
          <Text style={styles.requestDriverMeta}>
            <Text style={styles.mono}>★ {stars}</Text> ({driver.totalRatings} {t('sender.ratings')})
          </Text>
          <Text style={styles.requestDriverSub}>
            <Text style={styles.mono}>{driver.totalDeliveries}</Text> {t('sender.completedDeliveries')}
            {driver.carModel ? ` · ${driver.carModel}` : ''}
            {driver.maxLoadKg ? ` · max ${driver.maxLoadKg}kg` : ''}
          </Text>
        </View>
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
      <View style={styles.trackerHeader}>
        <Feather name="navigation" size={13} color={colors.primaryLight} />
        <Text style={styles.trackerTitle}>{t('sender.driverLocation')}</Text>
      </View>
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
  const insets = useSafeAreaInsets();
  const { data: deliveries, isLoading, refetch, isRefetching } = useMyDeliveries();
  const [filter, setFilter] = useState<FilterTab>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Re-derive the open delivery from the latest list so the Track modal's
  // status, progress and live tracker stay current as the driver advances it.
  const selectedDelivery = deliveries?.find((d) => d.id === selectedId) ?? null;
  const confirmDelivery = useConfirmDelivery();
  const rejectDriver = useRejectDriver();

  const filtered = deliveries?.filter((d) => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(d.status);
    if (filter === 'completed') return COMPLETED_STATUSES.includes(d.status);
    return true;
  });

  const activeCount = deliveries?.filter((d) => ACTIVE_STATUSES.includes(d.status)).length ?? 0;
  const completedCount = deliveries?.filter((d) => COMPLETED_STATUSES.includes(d.status)).length ?? 0;
  const allCount = deliveries?.length ?? 0;

  // Map the existing active/completed/all filter state onto SegmentedControl segments.
  const segments = [
    { key: 'active', label: t('common.active'), count: activeCount },
    { key: 'completed', label: t('common.completed'), count: completedCount },
    { key: 'all', label: t('common.all'), count: allCount },
  ];

  const handleConfirm = async (id: string) => {
    try {
      await confirmDelivery.mutateAsync(id);
      Alert.alert(t('sender.driverConfirmed'));
      setSelectedId(null);
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectDriver.mutateAsync(id);
      Alert.alert(t('sender.driverRejected'));
      setSelectedId(null);
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: DeliveryRequest }) => (
      <DeliveryCard delivery={item} onPress={() => setSelectedId(item.id)} />
    ),
    [],
  );

  if (isLoading) return <LoadingSpinner />;

  const sel = selectedDelivery;
  const trackingId = sel ? `#PD-${sel.id.slice(-6).toUpperCase()}` : '';
  const currentIdx = sel
    ? PROGRESS_STEPS.reduce((acc, step, i) => (step.reaches.includes(sel.status) ? i : acc), -1)
    : -1;
  const showCodeReminder =
    !!sel && (sel.status === 'accepted' || sel.status === 'in_transit') && !!sel.pickupCode;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>My shipments</Text>
        <SegmentedControl
          segments={segments}
          value={filter}
          onChange={(k) => setFilter(k as FilterTab)}
          style={styles.segmented}
        />
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

      {/* Detail / Track modal */}
      <Modal
        visible={!!selectedDelivery}
        onClose={() => setSelectedId(null)}
        title={selectedDelivery?.packageDescription || t('sender.delivery')}
      >
        {sel && (
          <View style={styles.detail}>
            {/* Map hero */}
            <View style={styles.mapWrap}>
              <MapHeader height={248}>
                <View style={styles.mapOverlay}>
                  <Pill label={trackingId} mono tone="glass" onDark style={styles.trackPill} />
                  <StatusBadge status={sel.status} />
                </View>
              </MapHeader>
            </View>

            {/* Driver card overlapping the map */}
            {sel.driver && sel.status !== 'requested' && (
              <View style={styles.driverCardOverlap}>
                <View style={styles.driverTopRow}>
                  <Avatar
                    firstName={sel.driver.firstName}
                    lastName={sel.driver.lastName}
                    uri={(sel.driver as any).avatarUrl}
                    size={48}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.driverCardName}>
                      {sel.driver.firstName} {sel.driver.lastName}
                    </Text>
                    <Text style={styles.driverCardMeta}>
                      {(sel.driver as any).averageRating != null && (
                        <Text>★ {(sel.driver as any).averageRating.toFixed(1)} · </Text>
                      )}
                      {(sel.driver as any).carModel || t('sender.searchDrivers')}
                      {(sel.driver as any).licensePlate ? ` · ${(sel.driver as any).licensePlate}` : ''}
                    </Text>
                  </View>
                  <View style={styles.contactRow}>
                    <TouchableOpacity activeOpacity={0.85} style={styles.callBtn}>
                      <Feather name="phone" size={17} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.85} style={styles.chatBtn}>
                      <Feather name="message-circle" size={17} color={colors.textInverse} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* 3-step mini progress */}
                <View style={styles.progressRow}>
                  {PROGRESS_STEPS.map((step, i) => {
                    const done = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <React.Fragment key={step.label}>
                        <View style={styles.progressStep}>
                          <View
                            style={[
                              styles.progressDot,
                              done && styles.progressDotDone,
                              isCurrent && styles.progressDotCurrent,
                            ]}
                          />
                          <Text style={[styles.progressLabel, done && styles.progressLabelDone]}>
                            {step.label}
                          </Text>
                        </View>
                        {i < PROGRESS_STEPS.length - 1 && (
                          <View style={[styles.progressBar, i < currentIdx && styles.progressBarDone]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Route */}
            <View style={styles.routeCard}>
              <RouteLine
                from={{ label: sel.pickupAddress.label, sub: t('sender.pickup') }}
                to={{ label: sel.deliveryAddress.label, sub: t('sender.delivery') }}
              />
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>{t('sender.budget')}</Text>
                <Text style={styles.budgetValue}>CHF {sel.budgetCHF.toFixed(0)}</Text>
              </View>
            </View>

            {/* Driver confirmation when status is 'requested' */}
            {sel.status === 'requested' && (
              <DriverRatingCard
                deliveryId={sel.id}
                onConfirm={() => handleConfirm(sel.id)}
                onReject={() => handleReject(sel.id)}
                confirming={confirmDelivery.isPending}
                rejecting={rejectDriver.isPending}
              />
            )}

            {/* Live driver tracking */}
            {(sel.status === 'accepted' || sel.status === 'in_transit') && (
              <DriverTracker deliveryId={sel.id} />
            )}

            {/* Senders see the pickup code; the recipient holds the delivery code. */}
            {showCodeReminder && (
              <View style={styles.codeReminder}>
                <View style={styles.codeReminderHead}>
                  <Feather name="key" size={14} color={colors.signalText} />
                  <Text style={styles.codeReminderTitle}>{t('sender.pickupCodeTitle')}</Text>
                </View>
                <Text style={styles.codeReminderValue}>{sel.pickupCode}</Text>
                <Text style={styles.codeReminderHint}>{t('sender.pickupCodeHint')}</Text>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mono: { fontFamily: typography.figure.fontFamily },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  segmented: {
    marginTop: spacing.md,
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  detail: {
    paddingTop: spacing.xs,
  },

  // ── Map hero ──
  mapWrap: {
    marginHorizontal: -spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  mapOverlay: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trackPill: {
    alignSelf: 'flex-start',
  },

  // ── Driver card overlapping the map ──
  driverCardOverlap: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: -26,
    ...shadow.sheet,
  },
  driverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverCardName: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.text,
  },
  driverCardMeta: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7EDE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },

  // ── 3-step mini progress ──
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStep: {
    alignItems: 'center',
    width: 78,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
  progressDotDone: {
    backgroundColor: colors.primary,
  },
  progressDotCurrent: {
    backgroundColor: colors.signal,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  progressLabelDone: {
    color: colors.text,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginTop: 5,
    marginHorizontal: -28,
  },
  progressBarDone: {
    backgroundColor: colors.primary,
  },

  // ── Route card ──
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  budgetLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  budgetValue: {
    ...typography.figure,
    color: colors.text,
  },

  // ── Loading ──
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
  },

  // ── Driver request card (status === requested) ──
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.signal,
    padding: spacing.md,
    marginTop: spacing.md,
    shadowColor: colors.signal,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  requestBadge: {
    backgroundColor: colors.signalSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  requestBadgeText: {
    ...typography.overline,
    color: colors.signalText,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  requestDriverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  requestDriverName: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.text,
  },
  requestDriverMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  requestDriverSub: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 1,
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

  // ── Live tracker ──
  trackerCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.xs,
  },
  trackerTitle: {
    ...typography.overline,
    color: colors.primaryLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  trackerCoords: {
    ...typography.figure,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  trackerTime: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  trackerWaiting: {
    ...typography.caption,
    color: colors.textLight,
  },

  // ── Pickup code reminder (marigold) ──
  codeReminder: {
    backgroundColor: colors.signalSoft,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#F0D9A8',
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  codeReminderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
  },
  codeReminderTitle: {
    ...typography.overline,
    color: colors.signalText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  codeReminderValue: {
    ...typography.code,
    fontSize: 30,
    color: colors.signalText,
    letterSpacing: 8,
    marginBottom: spacing.xs,
  },
  codeReminderHint: {
    ...typography.caption,
    color: colors.signalText,
    opacity: 0.8,
    textAlign: 'center',
  },
});
