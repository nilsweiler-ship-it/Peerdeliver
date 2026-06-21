import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useMyDeliveries, useConfirmDelivery, useRejectDriver, useDriverInfo } from '../../queries/delivery';
import { useMyRoutes } from '../../queries/route';
import { useConversations } from '../../queries/chat';
import { Button } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { RouteCard } from '../../components/route/RouteCard';
import { ImpactCard, RouteLine, StatusBadge } from '../../components/brand';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';
import type { DeliveryStatus } from '@peerdeliver/shared';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'requested', 'matched', 'accepted', 'picked_up', 'in_transit'];

function ActionNeededCard({ delivery, onDone }: { delivery: any; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: driver } = useDriverInfo(delivery.id);
  const confirmDelivery = useConfirmDelivery();
  const rejectDriver = useRejectDriver();

  const handleConfirm = async () => {
    try {
      await confirmDelivery.mutateAsync(delivery.id);
      Alert.alert(t('sender.driverConfirmed'));
      onDone();
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const handleReject = async () => {
    try {
      await rejectDriver.mutateAsync(delivery.id);
      Alert.alert(t('sender.driverRejected'));
      onDone();
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  if (!driver) return null;

  const stars = driver.averageRating ? driver.averageRating.toFixed(1) : 'N/A';

  return (
    <View style={styles.actionCard}>
      <View style={styles.actionHeader}>
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{t('home.actionNeeded')}</Text>
        </View>
        <Text style={styles.actionPrice}>CHF {delivery.budgetCHF.toFixed(0)}</Text>
      </View>

      <RouteLine
        from={delivery.pickupAddress.label}
        to={delivery.deliveryAddress.label}
        style={styles.actionRoute}
      />

      <View style={styles.driverRow}>
        <Avatar firstName={driver.firstName} lastName={driver.lastName} uri={driver.avatarUrl} size={36} />
        <View style={styles.flex}>
          <Text style={styles.driverName}>
            {driver.firstName} {driver.lastName}
          </Text>
          <Text style={styles.driverMeta}>
            <Text style={styles.mono}>★ {stars}</Text> ({driver.totalRatings})
            {driver.carModel ? ` · ${driver.carModel}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <Button
          title={t('sender.rejectDriver')}
          onPress={handleReject}
          variant="outline"
          loading={rejectDriver.isPending}
          style={styles.rejectBtn}
        />
        <Button
          title={t('sender.confirmDriver')}
          onPress={handleConfirm}
          loading={confirmDelivery.isPending}
          style={styles.confirmBtn}
        />
      </View>
    </View>
  );
}

export function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const isSender = role === 'sender' || role === 'both';
  const isDriver = role === 'driver' || role === 'both';

  const { data: deliveries, refetch: refetchDeliveries } = useMyDeliveries();
  const { data: routes } = useMyRoutes({ enabled: isDriver });
  const { data: conversations } = useConversations();

  const activeDeliveries = deliveries?.filter((d) => ACTIVE_STATUSES.includes(d.status)) || [];
  const requestedDeliveries = deliveries?.filter((d) => d.status === 'requested') || [];
  const senderDeliveries = activeDeliveries.filter((d) => d.senderId === user?.id);
  const driverDeliveries = activeDeliveries.filter((d) => d.driverId === user?.id);
  const activeRoutes = routes?.filter((r) => r.isActive) || [];
  const unreadCount = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) || 0;

  const co2 = user?.co2Saved ?? 0;
  const carTrips = Math.max(0, Math.round(co2 / 1.6));
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.date}>{today.toUpperCase()}</Text>
          <Text style={styles.greeting} numberOfLines={1}>
            {t('common.welcome')}, {user?.firstName}
          </Text>
        </View>
        <View>
          <Avatar firstName={user?.firstName} lastName={user?.lastName} uri={user?.avatarUrl} size={46} />
          {unreadCount > 0 && <View style={styles.notifDot} />}
        </View>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate(isSender ? 'SenderStack' : 'DriverStack', {
            screen: isSender ? 'MyShipments' : 'ActiveDeliveries',
          })}
        >
          <Text style={styles.statNumber}>{(isSender ? senderDeliveries : driverDeliveries).length}</Text>
          <Text style={styles.statLabel}>{t('home.activeDeliveries')}</Text>
        </TouchableOpacity>
        {isDriver && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.statCard}
            onPress={() => navigation.navigate('DriverStack', { screen: 'MyRoutes' })}
          >
            <Text style={styles.statNumber}>{activeRoutes.length}</Text>
            <Text style={styles.statLabel}>{t('home.activeRoutes')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('ChatStack')}
        >
          <Text style={[styles.statNumber, unreadCount > 0 && styles.statHighlight]}>{unreadCount}</Text>
          <Text style={styles.statLabel}>{t('home.unreadMessages')}</Text>
        </TouchableOpacity>
      </View>

      {/* Impact card */}
      <ImpactCard
        amount={`${co2.toFixed(1)} kg`}
        caption="CO₂ saved this year"
        sub={`≈ ${carTrips} car trips never made`}
        onPress={() => navigation.navigate('Profile')}
        style={styles.block}
      />

      {/* ===== SENDER SECTION ===== */}
      {isSender && (
        <View style={styles.section}>
          <Button
            title={t('sender.createRequest')}
            onPress={() => navigation.navigate('SenderStack', { screen: 'CreateRequest' })}
          />

          {requestedDeliveries.length > 0 && (
            <View style={styles.subsection}>
              {requestedDeliveries.map((d) => (
                <ActionNeededCard key={d.id} delivery={d} onDone={() => refetchDeliveries()} />
              ))}
            </View>
          )}

          {senderDeliveries.filter((d) => d.status !== 'requested').length > 0 && (
            <View style={styles.subsection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.subsectionTitle}>{t('home.recentShipments')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('SenderStack', { screen: 'MyShipments' })}>
                  <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {senderDeliveries.filter((d) => d.status !== 'requested').slice(0, 3).map((delivery) => (
                <ActiveRouteRow
                  key={delivery.id}
                  from={delivery.pickupAddress.label}
                  to={delivery.deliveryAddress.label}
                  status={delivery.status}
                  onPress={() => navigation.navigate('SenderStack', { screen: 'MyShipments' })}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ===== DRIVER SECTION ===== */}
      {isDriver && (
        <View style={styles.section}>
          <View style={styles.driverActions}>
            <Button
              title={t('driver.availableDeliveries')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'AvailableDeliveries' })}
              style={styles.driverActionBtn}
            />
            <Button
              title={t('driver.publishRoute')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'PublishRoute' })}
              variant="outline"
              style={styles.driverActionBtn}
            />
          </View>

          {activeRoutes.length > 0 && (
            <View style={styles.subsection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.subsectionTitle}>{t('home.activeRoutes')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('DriverStack', { screen: 'MyRoutes' })}>
                  <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {activeRoutes.slice(0, 3).map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onPress={() => navigation.navigate('DriverStack', { screen: 'MyRoutes' })}
                />
              ))}
            </View>
          )}

          {driverDeliveries.length > 0 && (
            <View style={styles.subsection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.subsectionTitle}>{t('driver.myDeliveries')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('DriverStack', { screen: 'ActiveDeliveries' })}>
                  <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {driverDeliveries.slice(0, 3).map((delivery) => (
                <ActiveRouteRow
                  key={delivery.id}
                  from={delivery.pickupAddress.label}
                  to={delivery.deliveryAddress.label}
                  status={delivery.status}
                  onPress={() => navigation.navigate('DriverStack', { screen: 'ActiveDeliveries' })}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ActiveRouteRow({
  from,
  to,
  status,
  onPress,
}: {
  from: string;
  to: string;
  status: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.routeRow} onPress={onPress}>
      <View style={styles.routeRowHeader}>
        <StatusBadge status={status} />
      </View>
      <RouteLine from={from} to={to} variant="horizontal" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  date: {
    ...typography.overline,
    color: colors.textLight,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  greeting: {
    ...typography.h1,
    color: colors.text,
  },
  notifDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-start',
    ...shadow.card,
  },
  statNumber: {
    ...typography.figure,
    fontSize: 27,
    color: colors.text,
  },
  statHighlight: {
    color: colors.destination,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  block: {
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  subsection: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  subsectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAll: {
    ...typography.bodySmall,
    color: colors.primary,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  driverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  driverActionBtn: {
    flex: 1,
  },
  mono: {
    fontFamily: typography.figure.fontFamily,
  },
  // action-needed card
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.signal,
    padding: spacing.md,
    shadowColor: colors.signal,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionBadge: {
    backgroundColor: colors.signalSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  actionBadgeText: {
    ...typography.overline,
    color: colors.signalText,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionPrice: {
    ...typography.figure,
    color: colors.text,
  },
  actionRoute: {
    marginBottom: spacing.md,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  driverName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  driverMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rejectBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 2,
  },
  routeRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  routeRowHeader: {
    flexDirection: 'row',
  },
});
