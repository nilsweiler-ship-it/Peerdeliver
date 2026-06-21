import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Input, Button, EmptyState, LoadingSpinner, Modal } from '../../components/ui';
import { RouteCard } from '../../components/route/RouteCard';
import { RouteLine, BackChip } from '../../components/brand';
import { useSearchRoutes } from '../../queries/route';
import { colors, spacing, typography } from '../../theme';
import type { DriverRoute } from '@peerdeliver/shared';

// Simple geocoding for Swiss cities (demo purposes)
const SWISS_CITIES: Record<string, { lat: number; lng: number }> = {
  zurich: { lat: 47.3769, lng: 8.5417 },
  zürich: { lat: 47.3769, lng: 8.5417 },
  bern: { lat: 46.9481, lng: 7.4474 },
  basel: { lat: 47.5596, lng: 7.5886 },
  geneva: { lat: 46.2044, lng: 6.1432 },
  genève: { lat: 46.2044, lng: 6.1432 },
  genf: { lat: 46.2044, lng: 6.1432 },
  lausanne: { lat: 46.5197, lng: 6.6323 },
  lucerne: { lat: 47.0502, lng: 8.3093 },
  luzern: { lat: 47.0502, lng: 8.3093 },
  st_gallen: { lat: 47.4245, lng: 9.3767 },
  winterthur: { lat: 47.5001, lng: 8.724 },
  lugano: { lat: 46.0037, lng: 8.9511 },
};

function geocodeCity(name: string): { lat: number; lng: number } | null {
  const key = name.toLowerCase().trim().replace(/[. ]/g, '_');
  return SWISS_CITIES[key] || null;
}

export function SearchDriversScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchParams, setSearchParams] = useState<{
    fromLat?: number;
    fromLng?: number;
    toLat?: number;
    toLng?: number;
  }>({});
  const [selectedRoute, setSelectedRoute] = useState<DriverRoute | null>(null);

  const { data: routes, isLoading, isFetched } = useSearchRoutes(searchParams);

  const handleSearch = () => {
    const fromCoords = geocodeCity(from);
    const toCoords = geocodeCity(to);

    if (!fromCoords || !toCoords) {
      Alert.alert(
        t('common.error'),
        'Could not find location. Try: Zurich, Bern, Basel, Geneva, Lausanne, Lucerne, Lugano',
      );
      return;
    }

    setSearchParams({
      fromLat: fromCoords.lat,
      fromLng: fromCoords.lng,
      toLat: toCoords.lat,
      toLng: toCoords.lng,
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
        <Input
          label={t('sender.fromLocation')}
          value={from}
          onChangeText={setFrom}
          placeholder="e.g. Zurich"
        />
        <Input
          label={t('sender.toLocation')}
          value={to}
          onChangeText={setTo}
          placeholder="e.g. Bern"
        />
        <Button
          title={t('common.search')}
          onPress={handleSearch}
          loading={isLoading}
          disabled={!from.trim() || !to.trim()}
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
