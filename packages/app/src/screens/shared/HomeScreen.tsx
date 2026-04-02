import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useMyDeliveries } from '../../queries/delivery';
import { useMyRoutes } from '../../queries/route';
import { useConversations } from '../../queries/chat';
import { Button, Card } from '../../components/ui';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { RouteCard } from '../../components/route/RouteCard';
import { colors, spacing, typography } from '../../theme';
import type { DeliveryStatus } from '@peerdeliver/shared';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'matched', 'accepted', 'picked_up', 'in_transit'];

export function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const isSender = role === 'sender' || role === 'both';
  const isDriver = role === 'driver' || role === 'both';

  const { data: deliveries } = useMyDeliveries();
  const { data: routes } = useMyRoutes({ enabled: isDriver });
  const { data: conversations } = useConversations();

  const activeDeliveries = deliveries?.filter((d) => ACTIVE_STATUSES.includes(d.status)) || [];
  const activeRoutes = routes?.filter((r) => r.isActive) || [];
  const unreadCount = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Welcome */}
      <Text style={styles.greeting}>
        {t('common.welcome')}, {user?.firstName}!
      </Text>
      <Text style={styles.tagline}>{t('tagline')}</Text>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        {isSender && (
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{activeDeliveries.length}</Text>
            <Text style={styles.statLabel}>{t('home.activeDeliveries')}</Text>
          </Card>
        )}
        {isDriver && (
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{activeRoutes.length}</Text>
            <Text style={styles.statLabel}>{t('home.activeRoutes')}</Text>
          </Card>
        )}
        <Card style={styles.statCard}>
          <Text style={[styles.statNumber, unreadCount > 0 && styles.statHighlight]}>
            {unreadCount}
          </Text>
          <Text style={styles.statLabel}>{t('home.unreadMessages')}</Text>
        </Card>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
      <View style={styles.actions}>
        {isSender && (
          <>
            <Button
              title={t('sender.createRequest')}
              onPress={() => navigation.navigate('SenderStack', { screen: 'CreateRequest' })}
            />
            <Button
              title={t('sender.searchDrivers')}
              onPress={() => navigation.navigate('SenderStack', { screen: 'SearchDrivers' })}
              variant="outline"
            />
          </>
        )}
        {isDriver && (
          <>
            <Button
              title={t('driver.publishRoute')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'PublishRoute' })}
            />
            <Button
              title={t('driver.availableDeliveries')}
              onPress={() =>
                navigation.navigate('DriverStack', { screen: 'AvailableDeliveries' })
              }
              variant="outline"
            />
          </>
        )}
      </View>

      {/* Recent shipments */}
      {isSender && activeDeliveries.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recentShipments')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SenderStack', { screen: 'MyShipments' })}
            >
              <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          {activeDeliveries.slice(0, 3).map((delivery) => (
            <DeliveryCard key={delivery.id} delivery={delivery} />
          ))}
        </View>
      )}

      {/* Recent routes */}
      {isDriver && activeRoutes.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recentDeliveries')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('DriverStack', { screen: 'MyRoutes' })}
            >
              <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          {activeRoutes.slice(0, 3).map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
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
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAll: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  recentSection: {
    marginTop: spacing.md,
  },
});
