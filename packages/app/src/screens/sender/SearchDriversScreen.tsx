import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingSpinner, Modal, AddressAutocomplete } from '../../components/ui';
import type { AddressSelection } from '../../components/ui/AddressAutocomplete';
import { RouteCard } from '../../components/route/RouteCard';
import { RouteLine, BackChip } from '../../components/brand';
import { useSearchRoutes } from '../../queries/route';
import { colors, spacing, typography } from '../../theme';
import type { DriverRoute } from '@peerdeliver/shared';

export function SearchDriversScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Full addresses from the Swiss federal geo.admin.ch index, the same source
  // the rest of the app uses. This screen previously matched against a
  // hardcoded list of twelve cities and rejected everything else — so a search
  // from a village, or from a street address, always failed.
  const [from, setFrom] = useState<AddressSelection | null>(null);
  const [to, setTo] = useState<AddressSelection | null>(null);
  const [searchParams, setSearchParams] = useState<{
    fromLat?: number;
    fromLng?: number;
    toLat?: number;
    toLng?: number;
  }>({});
  const [selectedRoute, setSelectedRoute] = useState<DriverRoute | null>(null);

  const { data: routes, isLoading, isFetched } = useSearchRoutes(searchParams);

  const handleSearch = () => {
    if (!from || !to) return;
    setSearchParams({
      fromLat: from.point.lat,
      fromLng: from.point.lng,
      toLat: to.point.lat,
      toLng: to.point.lng,
    });
  };

  const hasSearched = isFetched && !!searchParams.fromLat;

  return (
    <View style={styles.container}>
      {/* Search inputs */}
      <View style={[styles.searchBox, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <BackChip onPress={() => navigation.goBack()} />
        </View>
        <Text style={styles.eyebrow}>{t('sender.findDrivers', 'Find drivers').toUpperCase()}</Text>
        <Text style={styles.title}>{t('common.search')}</Text>
        <AddressAutocomplete
          label={t('sender.fromLocation')}
          placeholder={t('common.addressPlaceholder', 'Adresse oder Ort')}
          onSelect={setFrom}
        />
        <AddressAutocomplete
          label={t('sender.toLocation')}
          placeholder={t('common.addressPlaceholder', 'Adresse oder Ort')}
          onSelect={setTo}
        />
        <Button
          title={t('common.search')}
          onPress={handleSearch}
          loading={isLoading}
          disabled={!from || !to}
        />
      </View>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={routes}
          renderItem={({ item }) => (
            <RouteCard route={item} showDriver onPress={() => setSelectedRoute(item)} />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState
                icon="🔍"
                title={t('sender.noDrivers')}
                message={t('sender.noDriversMessage')}
              />
            ) : null
          }
        />
      )}

      {/* Route detail modal */}
      <Modal
        visible={!!selectedRoute}
        onClose={() => setSelectedRoute(null)}
        title={selectedRoute ? `${selectedRoute.originAddress} → ${selectedRoute.destinationAddress}` : ''}
      >
        {selectedRoute && (
          <View style={styles.detail}>
            <RouteLine
              from={selectedRoute.originAddress}
              to={selectedRoute.destinationAddress}
              style={styles.detailRoute}
            />
            {selectedRoute.driver && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Driver</Text>
                <Text style={styles.detailValue}>
                  {selectedRoute.driver.firstName} {selectedRoute.driver.lastName}
                </Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('driver.availableSpace')}</Text>
              <Text style={styles.detailValue}>{selectedRoute.availableSize}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('driver.routeType')}</Text>
              <Text style={styles.detailValue}>
                {selectedRoute.routeType === 'recurring' ? t('driver.recurring') : t('driver.oneTime')}
              </Text>
            </View>
            <Button
              title={t('sender.requestOnRoute')}
              onPress={() => {
                setSelectedRoute(null);
                Alert.alert(t('sender.requestOnRoute'), 'Feature coming soon');
              }}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBox: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.textLight,
    letterSpacing: 1.2,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  detail: {
    gap: spacing.sm,
  },
  detailRoute: {
    marginBottom: spacing.sm,
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
    ...typography.bodyStrong,
    color: colors.text,
  },
});
