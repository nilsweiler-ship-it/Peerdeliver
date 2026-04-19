import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries, useVerifyPickup, useVerifyDelivery, useUpdateDeliveryStatus } from '../../queries/delivery';
import { Button, Input, Card, EmptyState, LoadingSpinner } from '../../components/ui';
import { StatusTimeline } from '../../components/delivery/StatusTimeline';
import { useSocket } from '../../providers/SocketProvider';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius } from '../../theme';
import * as Location from 'expo-location';
import type { DeliveryRequest, DeliveryStatus } from '@peerdeliver/shared';
import { SOCKET_EVENTS } from '@peerdeliver/shared';

const DRIVER_ACTIVE_STATUSES: DeliveryStatus[] = ['requested', 'matched', 'accepted', 'picked_up', 'in_transit'];

function DeliveryActionCard({ delivery }: { delivery: DeliveryRequest }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const verifyPickup = useVerifyPickup();
  const verifyDelivery = useVerifyDelivery();
  const updateStatus = useUpdateDeliveryStatus();

  const handleAcceptJob = async () => {
    try {
      await updateStatus.mutateAsync({ id: delivery.id, status: 'accepted' });
      Alert.alert(t('driver.statusUpdated'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || err?.message);
    }
  };

  const handleVerifyPickup = async () => {
    if (code.length !== 6) {
      Alert.alert(t('common.error'), t('driver.codeLength'));
      return;
    }
    try {
      await verifyPickup.mutateAsync({ id: delivery.id, code });
      Alert.alert(t('driver.pickupConfirmed'));
      setCode('');
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || err?.message);
    }
  };

  const handleVerifyDelivery = async () => {
    if (code.length !== 6) {
      Alert.alert(t('common.error'), t('driver.codeLength'));
      return;
    }
    try {
      await verifyDelivery.mutateAsync({ id: delivery.id, code });
      Alert.alert(t('driver.deliveryConfirmed'));
      setCode('');
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || err?.message);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{delivery.packageDescription || t('sender.delivery')}</Text>
      <StatusTimeline currentStatus={delivery.status} />

      <View style={styles.addressRow}>
        <Text style={styles.addressLabel}>{t('sender.pickup')}</Text>
        <Text style={styles.addressValue}>{delivery.pickupAddress.label}</Text>
      </View>
      <View style={styles.addressRow}>
        <Text style={styles.addressLabel}>{t('sender.delivery')}</Text>
        <Text style={styles.addressValue}>{delivery.deliveryAddress.label}</Text>
      </View>
      <View style={styles.addressRow}>
        <Text style={styles.addressLabel}>{t('sender.budget')}</Text>
        <Text style={styles.addressValue}>CHF {delivery.budgetCHF.toFixed(0)}</Text>
      </View>

      {/* Matched: driver can start heading to pickup */}
      {delivery.status === 'matched' && (
        <Button
          title={t('driver.startPickup')}
          onPress={handleAcceptJob}
          loading={updateStatus.isPending}
          style={styles.actionButton}
        />
      )}

      {/* Accepted: driver enters pickup code from sender */}
      {delivery.status === 'accepted' && (
        <View style={styles.codeSection}>
          <Text style={styles.codePrompt}>{t('driver.enterPickupCode')}</Text>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            title={t('driver.confirmPickup')}
            onPress={handleVerifyPickup}
            loading={verifyPickup.isPending}
          />
        </View>
      )}

      {/* In transit: driver enters delivery code from recipient */}
      {delivery.status === 'in_transit' && (
        <View style={styles.codeSection}>
          <Text style={styles.codePrompt}>{t('driver.enterDeliveryCode')}</Text>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            title={t('driver.confirmDelivery')}
            onPress={handleVerifyDelivery}
            loading={verifyDelivery.isPending}
          />
        </View>
      )}

      {/* Waiting states */}
      {delivery.status === 'requested' && (
        <View style={styles.waitingBadge}>
          <Text style={styles.waitingText}>{t('driver.waitingSenderConfirm')}</Text>
        </View>
      )}
    </Card>
  );
}

export function ActiveDeliveryScreen() {
  const { t } = useTranslation();
  const { data: deliveries, isLoading, refetch, isRefetching } = useMyDeliveries();
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeDeliveries = deliveries?.filter((d) => DRIVER_ACTIVE_STATUSES.includes(d.status)) || [];

  // Emit location updates for in-progress deliveries (accepted or in_transit)
  const inProgressDeliveries = activeDeliveries.filter(
    (d) => d.status === 'accepted' || d.status === 'in_transit',
  );

  useEffect(() => {
    if (!socket || !user?.shareLocation || inProgressDeliveries.length === 0) {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      // Join tracking rooms
      inProgressDeliveries.forEach((d) => {
        socket.emit(SOCKET_EVENTS.TRACKING_START, d.id);
      });

      const sendLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          inProgressDeliveries.forEach((d) => {
            socket.emit(SOCKET_EVENTS.TRACKING_LOCATION_UPDATE, {
              deliveryRequestId: d.id,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            });
          });
        } catch {
          // silently ignore location errors
        }
      };

      await sendLocation();
      if (!cancelled) {
        locationIntervalRef.current = setInterval(sendLocation, 10000);
      }
    };

    startTracking();

    return () => {
      cancelled = true;
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      inProgressDeliveries.forEach((d) => {
        socket.emit(SOCKET_EVENTS.TRACKING_STOP, d.id);
      });
    };
  }, [socket, user?.shareLocation, inProgressDeliveries.length]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {activeDeliveries.length === 0 ? (
        <EmptyState
          icon="📦"
          title={t('driver.noActiveDeliveries')}
          message={t('driver.noActiveDeliveriesMessage')}
        />
      ) : (
        activeDeliveries.map((delivery) => (
          <DeliveryActionCard key={delivery.id} delivery={delivery} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  addressLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  addressValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  codeSection: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  codePrompt: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  waitingText: {
    ...typography.bodySmall,
    color: colors.warning,
    fontWeight: '600',
  },
});
