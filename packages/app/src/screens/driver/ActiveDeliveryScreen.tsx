import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMyDeliveries, useVerifyPickup, useVerifyDelivery, useUpdateDeliveryStatus } from '../../queries/delivery';
import { Button, EmptyState, LoadingSpinner } from '../../components/ui';
import { StatusTimeline } from '../../components/delivery/StatusTimeline';
import { LiveMap, BackChip, Pill, RouteLine, TicketStub, CodeBoxes } from '../../components/brand';
import { useSocket } from '../../providers/SocketProvider';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';
import * as Location from 'expo-location';
import {
  requestBackgroundPermission,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '../../services/backgroundLocation';
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

  const isPickupCode = delivery.status === 'accepted';
  const isDeliveryCode = delivery.status === 'in_transit';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{delivery.packageDescription || t('sender.delivery')}</Text>

      {/* Vertical status timeline */}
      <View style={styles.timelineWrap}>
        <StatusTimeline currentStatus={delivery.status} orientation="vertical" />
      </View>

      {/* Route line card */}
      <View style={styles.routeCard}>
        <RouteLine
          from={{ label: delivery.pickupAddress.label, sub: t('sender.pickup') }}
          to={{ label: delivery.deliveryAddress.label, sub: t('sender.delivery') }}
          gap={26}
        />
        <View style={styles.routeDivider} />
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>{t('sender.budget')}</Text>
          <Text style={styles.budgetValue}>CHF {delivery.budgetCHF.toFixed(0)}</Text>
        </View>
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
      {isPickupCode && (
        <View style={styles.codeSection}>
          <Text style={styles.codePrompt}>{t('driver.enterPickupCode')}</Text>
          <TicketStub
            title="PICKUP CODE"
            locked
            footer={
              <Button
                title={t('driver.confirmPickup')}
                onPress={handleVerifyPickup}
                loading={verifyPickup.isPending}
              />
            }
          >
            <CodeInput value={code} onChange={setCode} />
          </TicketStub>
        </View>
      )}

      {/* In transit: driver enters delivery code from recipient */}
      {isDeliveryCode && (
        <View style={styles.codeSection}>
          <Text style={styles.codePrompt}>{t('driver.enterDeliveryCode')}</Text>
          <TicketStub
            title="DELIVERY CODE"
            locked
            footer={
              <Button
                title={t('driver.confirmDelivery')}
                onPress={handleVerifyDelivery}
                loading={verifyDelivery.isPending}
              />
            }
          >
            <CodeInput value={code} onChange={setCode} />
          </TicketStub>
        </View>
      )}

      {/* Waiting states */}
      {delivery.status === 'requested' && (
        <View style={styles.waitingBadge}>
          <Text style={styles.waitingText}>{t('driver.waitingSenderConfirm')}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * 6-digit code: visible CodeBoxes backed by a hidden TextInput. Tapping anywhere
 * on the boxes re-focuses the input (so you can edit/backspace after typing).
 */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<TextInput>(null);
  return (
    <Pressable style={styles.codeInputWrap} onPress={() => inputRef.current?.focus()}>
      <CodeBoxes value={value} showActive />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

export function ActiveDeliveryScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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

    const deliveryIds = inProgressDeliveries.map((d) => d.id);

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      // Join tracking rooms
      deliveryIds.forEach((id) => {
        socket.emit(SOCKET_EVENTS.TRACKING_START, id);
      });

      const sendLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          deliveryIds.forEach((id) => {
            socket.emit(SOCKET_EVENTS.TRACKING_LOCATION_UPDATE, {
              deliveryRequestId: id,
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

      // Keep reporting once the screen locks or the driver switches apps —
      // otherwise the sender's map freezes exactly when the driving starts.
      // Declining background permission is fine: foreground tracking above
      // still works, so this is an enhancement rather than a requirement.
      if (!cancelled && (await requestBackgroundPermission()) && !cancelled) {
        await startBackgroundLocation(deliveryIds);
      }
    };

    startTracking();

    return () => {
      cancelled = true;
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      deliveryIds.forEach((id) => {
        socket.emit(SOCKET_EVENTS.TRACKING_STOP, id);
      });
      void stopBackgroundLocation();
    };
  }, [socket, user?.shareLocation, inProgressDeliveries.length]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <LiveMap
        height={212}
        from={activeDeliveries[0]?.pickupAddress.point}
        to={activeDeliveries[0]?.deliveryAddress.point}
      >
        {navigation?.canGoBack?.() && (
          <BackChip
            onDark
            onPress={() => navigation.goBack()}
            style={StyleSheet.flatten([styles.backChip, { top: insets.top + spacing.xs }])}
          />
        )}
        <Pill
          label="ETA 14:25"
          mono
          onDark
          style={StyleSheet.flatten([styles.etaPill, { top: insets.top + spacing.xs }])}
        />
      </LiveMap>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  backChip: {
    position: 'absolute',
    left: spacing.md,
  },
  etaPill: {
    position: 'absolute',
    right: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
  },
  timelineWrap: {
    paddingVertical: spacing.xs,
  },
  routeCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  budgetValue: {
    ...typography.figure,
    color: colors.text,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
  codeSection: {
    gap: spacing.sm,
  },
  codePrompt: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.bodyStrong.fontFamily,
    textAlign: 'center',
  },
  codeInputWrap: {
    position: 'relative',
  },
  // Tiny + offscreen so it captures the keyboard without intercepting taps on
  // the boxes (the Pressable wrapper handles focus).
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    top: 0,
    left: 0,
    opacity: 0,
    color: 'transparent',
  },
  waitingBadge: {
    backgroundColor: colors.signalSoft,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.signal,
  },
  waitingText: {
    ...typography.bodySmall,
    color: colors.signalText,
    fontFamily: typography.bodyStrong.fontFamily,
  },
});
