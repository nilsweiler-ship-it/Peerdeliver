import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNearbyDeliveries, useAssignDelivery } from '../../queries/delivery';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { EmptyState, LoadingSpinner, Button } from '../../components/ui';
import { Pill, BackChip } from '../../components/brand';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';
import type { DeliveryRequest } from '@peerdeliver/shared';
import { PACKAGE_SIZES } from '@peerdeliver/shared';

const SEARCH = { lat: 47.3769, lng: 8.5417, radius: 100 };

export function AvailableDeliveriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Default to Zurich center for demo — in production, use driver's first route origin
  const { data: deliveries, isLoading, refetch, isRefetching } = useNearbyDeliveries({
    lat: SEARCH.lat,
    lng: SEARCH.lng,
    radius: SEARCH.radius,
  });
  const assignDelivery = useAssignDelivery();
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRequest | null>(null);

  const handleAccept = async (delivery: DeliveryRequest) => {
    try {
      await assignDelivery.mutateAsync(delivery.id);
      Alert.alert(t('driver.requestSuccess'));
      setSelectedDelivery(null);
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: DeliveryRequest }) => {
      const distanceKm = (item as any).distanceKm as number | undefined;
      return (
        <View>
          {distanceKm != null && (
            <View style={styles.distanceRow}>
              <Pill
                label={`${distanceKm.toFixed(1)} km away`}
                icon="navigation"
                iconColor={colors.destination}
                mono
                tone="sunken"
              />
            </View>
          )}
          <DeliveryCard delivery={item} onPress={() => setSelectedDelivery(item)} />
        </View>
      );
    },
    [],
  );

  if (isLoading) return <LoadingSpinner />;

  const senderRating =
    selectedDelivery && (selectedDelivery as any).sender?.averageRating
      ? `★ ${((selectedDelivery as any).sender.averageRating as number).toFixed(1)} (${(selectedDelivery as any).sender.totalRatings})`
      : null;
  const detailDistance =
    selectedDelivery && (selectedDelivery as any).distanceKm != null
      ? `${((selectedDelivery as any).distanceKm as number).toFixed(1)} km`
      : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <BackChip onPress={() => navigation.goBack()} />
              <Text style={styles.title}>Available nearby</Text>
            </View>
            <Pill
              label="Zürich · 100 km radius"
              icon="map-pin"
              iconColor={colors.destination}
              style={styles.locationPill}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="📍"
            title={t('driver.noDeliveries')}
            message={t('driver.noDeliveriesMessage')}
          />
        }
      />

      {/* Delivery detail — bottom sheet */}
      <Modal
        visible={!!selectedDelivery}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDelivery(null)}
      >
        <Pressable style={styles.scrim} onPress={() => setSelectedDelivery(null)} />
        {selectedDelivery && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {(selectedDelivery.packageDescription || t('driver.availableDeliveries'))} ·{' '}
                {PACKAGE_SIZES[selectedDelivery.packageSize].label}
              </Text>
              <Text style={styles.sheetPrice}>CHF {selectedDelivery.budgetCHF.toFixed(0)}</Text>
            </View>

            <View style={styles.detail}>
              <DetailRow label={t('sender.pickup')} value={selectedDelivery.pickupAddress.label} />
              <DetailRow label={t('sender.delivery')} value={selectedDelivery.deliveryAddress.label} />
              {detailDistance && <DetailRow label="Distance" value={detailDistance} mono />}
              {senderRating && <DetailRow label={t('driver.senderRating')} value={senderRating} mono />}
            </View>

            <Button
              title={`${t('driver.requestDelivery')}  →`}
              onPress={() => handleAccept(selectedDelivery)}
              loading={assignDelivery.isPending}
              style={styles.cta}
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  headerBlock: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  locationPill: {
    marginTop: spacing.sm,
  },
  distanceRow: {
    marginBottom: spacing.xs,
  },
  // onboarding banner
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.signalSoft,
    borderWidth: 1,
    borderColor: colors.signal,
    borderRadius: borderRadius.xl,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    ...typography.bodySmall,
    color: colors.signalText,
    fontFamily: typography.bodyStrong.fontFamily,
    marginBottom: 2,
  },
  bannerBody: {
    ...typography.caption,
    color: colors.signalText,
  },
  // bottom sheet
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadow.sheet,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  sheetPrice: {
    ...typography.figure,
    color: colors.text,
  },
  detail: { gap: spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontFamily: typography.bodyStrong.fontFamily,
    flex: 1,
    textAlign: 'right',
  },
  detailValueMono: {
    fontFamily: typography.figure.fontFamily,
  },
  cta: {
    marginTop: spacing.lg,
  },
});
