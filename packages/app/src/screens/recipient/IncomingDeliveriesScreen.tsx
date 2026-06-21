import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { EmptyState, LoadingSpinner, Modal } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { GradientSurface, RouteWatermark, TicketStub } from '../../components/brand';
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

  const sel = selected;
  // Recipients hold the delivery code and show it to the driver; it only becomes
  // relevant once the parcel is in transit.
  const showCode = !!sel && sel.status === 'in_transit' && !!sel.deliveryCode;
  const isTerminal = sel?.status === 'delivered' || sel?.status === 'cancelled';

  const driver: any = sel?.driver;
  const driverRating =
    driver?.averageRating != null ? driver.averageRating.toFixed(1) : null;

  // "Valid until" — best-effort hint from the delivery window if present.
  const validUntil = (() => {
    const raw = (sel as any)?.deliveryWindowEnd || (sel as any)?.estimatedDeliveryAt;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  })();

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
        {sel && (
          <View style={styles.heroWrap}>
            <GradientSurface style={styles.hero}>
              <RouteWatermark size={240} opacity={0.1} style={{ right: -50, top: -30 }} />

              <Text style={styles.overline}>INCOMING DELIVERY</Text>

              {showCode ? (
                <>
                  <Text style={styles.heroTitle}>Your parcel is almost here</Text>
                  <Text style={styles.heroSub}>
                    Show this code to the driver to confirm you received it.
                  </Text>

                  <TicketStub title={t('recipient.deliveryCodeTitle')} locked style={styles.stub}>
                    <Text style={styles.code}>{sel.deliveryCode}</Text>
                    {validUntil && (
                      <View style={styles.validPill}>
                        <Feather name="clock" size={12} color={colors.impact} />
                        <Text style={styles.validText}>Valid until {validUntil}</Text>
                      </View>
                    )}
                  </TicketStub>

                  {driver && (
                    <View style={styles.driverRow}>
                      <Avatar
                        firstName={driver.firstName}
                        lastName={driver.lastName}
                        uri={driver.avatarUrl}
                        size={42}
                      />
                      <View style={styles.flex}>
                        <Text style={styles.driverName}>
                          {driver.firstName} {driver.lastName}
                        </Text>
                        <Text style={styles.driverMeta}>
                          {driverRating ? `★ ${driverRating}` : '★ —'} · arriving in ~12 min
                        </Text>
                      </View>
                      <TouchableOpacity activeOpacity={0.85} style={styles.callBtn}>
                        <Feather name="phone" size={18} color={colors.signalText} />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.heroTitle}>
                    {isTerminal
                      ? sel.status === 'delivered'
                        ? 'Delivered'
                        : 'Delivery cancelled'
                      : 'On its way to you'}
                  </Text>
                  <Text style={styles.heroSub}>
                    {isTerminal
                      ? t('recipient.deliveryCodeHint')
                      : t('recipient.codeAvailableWhenInTransit')}
                  </Text>

                  <View style={styles.waitCard}>
                    <View style={styles.waitRail}>
                      <View style={[styles.waitDot, styles.waitDotDone]} />
                      <View style={styles.waitLine} />
                      <View
                        style={[
                          styles.waitDot,
                          (sel.status === 'accepted' || sel.status === 'picked_up') && styles.waitDotCurrent,
                        ]}
                      />
                    </View>
                    <View style={styles.waitText}>
                      <Text style={styles.waitFrom}>{sel.pickupAddress.label}</Text>
                      <Text style={styles.waitTo}>{sel.deliveryAddress.label}</Text>
                    </View>
                  </View>

                  {sel.sender && (
                    <View style={styles.driverRow}>
                      <Avatar
                        firstName={sel.sender.firstName}
                        lastName={sel.sender.lastName}
                        uri={(sel.sender as any).avatarUrl}
                        size={42}
                      />
                      <View style={styles.flex}>
                        <Text style={styles.driverName}>
                          {sel.sender.firstName} {sel.sender.lastName}
                        </Text>
                        <Text style={styles.driverMeta}>{t('recipient.sender')}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              <View style={styles.safetyNote}>
                <Feather name="shield" size={13} color={colors.impactLeaf} />
                <Text style={styles.safetyText}>
                  Never share this code until the driver is in front of you.
                </Text>
              </View>
            </GradientSurface>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, flexGrow: 1 },

  // ── Hero (recipient code moment) ──
  heroWrap: {
    marginHorizontal: -spacing.lg,
    marginBottom: -spacing.xxl,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  overline: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    textAlign: 'center',
  },
  heroTitle: {
    ...typography.h1,
    color: colors.textInverse,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  heroSub: {
    ...typography.body,
    color: 'rgba(255,255,255,0.66)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // ── Code ticket ──
  stub: {
    marginTop: spacing.xl,
  },
  code: {
    ...typography.code,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: 9,
    color: colors.text,
    textAlign: 'center',
  },
  validPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.impactSurface,
    borderWidth: 1,
    borderColor: colors.impactSurfaceBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  validText: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    fontSize: 11,
    color: colors.impact,
  },

  // ── Driver / sender glass row ──
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginTop: spacing.lg,
  },
  driverName: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textInverse,
  },
  driverMeta: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Waiting state ──
  waitCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  waitRail: {
    alignItems: 'center',
    paddingTop: 4,
  },
  waitDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  waitDotDone: {
    backgroundColor: colors.impactLeaf,
  },
  waitDotCurrent: {
    backgroundColor: colors.signal,
  },
  waitLine: {
    width: 2,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 3,
  },
  waitText: {
    flex: 1,
    justifyContent: 'space-between',
  },
  waitFrom: {
    ...typography.bodyStrong,
    color: colors.textInverse,
    marginBottom: 20,
  },
  waitTo: {
    ...typography.bodyStrong,
    color: colors.textInverse,
  },

  // ── Safety note ──
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  safetyText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    flexShrink: 1,
  },
});
