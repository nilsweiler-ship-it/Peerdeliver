import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useMyDeliveries, useConfirmDelivery, useRejectDriver, useDriverInfo } from '../../queries/delivery';
import { useMyRoutes } from '../../queries/route';
import { useConversations } from '../../queries/chat';
import { Button, Card } from '../../components/ui';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { RouteCard } from '../../components/route/RouteCard';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { DeliveryStatus } from '@peerdeliver/shared';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'requested', 'matched', 'accepted', 'picked_up', 'in_transit'];

function DriverRequestBanner({ delivery, onDone }: { delivery: any; onDone: () => void }) {
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
    <Card style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestBadge}>{t('home.actionNeeded')}</Text>
      </View>
      <DeliveryCard delivery={delivery} />
      <View style={styles.requestDriverInfo}>
        <Text style={styles.requestDriverName}>
          {driver.firstName} {driver.lastName}
        </Text>
        <Text style={styles.requestDriverMeta}>
          {stars} ({driver.totalRatings} {t('sender.ratings')}) · {driver.totalDeliveries} {t('sender.completedDeliveries')}
        </Text>
        {driver.carModel && (
          <Text style={styles.requestDriverCar}>{driver.carModel}</Text>
        )}
      </View>
      <View style={styles.requestActions}>
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
    </Card>
  );
}

export function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Welcome */}
      <Text style={styles.greeting}>
        {t('common.welcome')}, {user?.firstName}!
      </Text>
      <Text style={styles.tagline}>{t('tagline')}</Text>

      {/* Stats row — all tappable */}
      <View style={styles.statsRow}>
        {isSender && (
          <TouchableOpacity
            style={styles.statTouchable}
            onPress={() => navigation.navigate('SenderStack', { screen: 'MyShipments' })}
          >
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{senderDeliveries.length}</Text>
              <Text style={styles.statLabel}>{t('home.activeDeliveries')}</Text>
            </Card>
          </TouchableOpacity>
        )}
        {isDriver && (
          <TouchableOpacity
            style={styles.statTouchable}
            onPress={() => navigation.navigate('DriverStack', { screen: 'MyRoutes' })}
          >
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{activeRoutes.length}</Text>
              <Text style={styles.statLabel}>{t('home.activeRoutes')}</Text>
            </Card>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.statTouchable}
          onPress={() => navigation.navigate('ChatStack')}
        >
          <Card style={styles.statCard}>
            <Text style={[styles.statNumber, unreadCount > 0 && styles.statHighlight]}>
              {unreadCount}
            </Text>
            <Text style={styles.statLabel}>{t('home.unreadMessages')}</Text>
          </Card>
        </TouchableOpacity>
      </View>

      {/* ===== SENDER SECTION ===== */}
      {isSender && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t('home.senderSection')}</Text>

          <Button
            title={t('sender.createRequest')}
            onPress={() => navigation.navigate('SenderStack', { screen: 'CreateRequest' })}
          />

          {/* Pending driver requests — action needed */}
          {requestedDeliveries.length > 0 && (
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>
                {t('home.pendingRequests')} ({requestedDeliveries.length})
              </Text>
              {requestedDeliveries.map((d) => (
                <DriverRequestBanner
                  key={d.id}
                  delivery={d}
                  onDone={() => refetchDeliveries()}
                />
              ))}
            </View>
          )}

          {/* Active shipments */}
          {senderDeliveries.length > 0 && (
            <View style={styles.subsection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.subsectionTitle}>{t('home.recentShipments')}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SenderStack', { screen: 'MyShipments' })}
                >
                  <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {senderDeliveries.filter((d) => d.status !== 'requested').slice(0, 3).map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
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
          <Text style={styles.sectionHeading}>{t('home.driverSection')}</Text>

          <View style={styles.driverActions}>
            <Button
              title={t('driver.myDeliveries')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'ActiveDeliveries' })}
              style={styles.driverActionBtn}
            />
            <Button
              title={t('driver.availableDeliveries')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'AvailableDeliveries' })}
              variant="outline"
              style={styles.driverActionBtn}
            />
          </View>

          <Button
            title={t('driver.publishRoute')}
            onPress={() => navigation.navigate('DriverStack', { screen: 'PublishRoute' })}
            variant="outline"
          />

          {/* Active routes */}
          {activeRoutes.length > 0 && (
            <View style={styles.subsection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.subsectionTitle}>{t('home.activeRoutes')}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('DriverStack', { screen: 'MyRoutes' })}
                >
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

          {/* Driver's active deliveries */}
          {driverDeliveries.length > 0 && (
            <View style={styles.subsection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.subsectionTitle}>{t('driver.myDeliveries')}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('DriverStack', { screen: 'ActiveDeliveries' })}
                >
                  <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {driverDeliveries.slice(0, 3).map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xl,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTouchable: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statNumber: {
    ...typography.h1,
    color: colors.primary,
  },
  statHighlight: {
    color: colors.accent,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionHeading: {
    ...typography.h2,
    color: colors.text,
  },
  subsection: {
    marginTop: spacing.sm,
  },
  subsectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  viewAll: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  driverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  driverActionBtn: {
    flex: 1,
  },
  requestCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  requestHeader: {
    marginBottom: spacing.xs,
  },
  requestBadge: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  requestDriverInfo: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  requestDriverName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  requestDriverMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  requestDriverCar: {
    ...typography.caption,
    color: colors.primary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rejectBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 2,
  },
});
