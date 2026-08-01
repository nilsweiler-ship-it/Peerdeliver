import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMyRoutes, useToggleRoute, useDeleteRoute } from '../../queries/route';
import { RouteCard } from '../../components/route/RouteCard';
import { EmptyState, LoadingSpinner, Modal, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import type { DriverRoute } from '@peerdeliver/shared';

export function MyRoutesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: routes, isLoading, refetch, isRefetching } = useMyRoutes();
  const toggleRoute = useToggleRoute();
  const deleteRoute = useDeleteRoute();
  const [selectedRoute, setSelectedRoute] = useState<DriverRoute | null>(null);

  const handleToggle = async (route: DriverRoute) => {
    try {
      await toggleRoute.mutateAsync({ id: route.id, isActive: !route.isActive });
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const handleDelete = (route: DriverRoute) => {
    Alert.alert(t('driver.deleteRoute'), t('driver.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoute.mutateAsync(route.id);
            setSelectedRoute(null);
          } catch {
            Alert.alert(t('common.error'));
          }
        },
      },
    ]);
  };

  const renderItem = useCallback(
    ({ item }: { item: DriverRoute }) => (
      <RouteCard route={item} onPress={() => setSelectedRoute(item)} />
    ),
    [],
  );

  if (isLoading) return <LoadingSpinner />;

  const activeCount = routes?.filter((r) => r.isActive).length ?? 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing.md }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{t('home.activeRoutes').toUpperCase()}</Text>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t('driver.myRoutes', 'My routes')}</Text>
              <Text style={styles.count}>{activeCount}</Text>
            </View>
          </View>
        }
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="🛣️"
            title={t('driver.noRoutes')}
            message={t('driver.noRoutesMessage')}
            actionLabel={t('driver.publishFirst')}
            onAction={() => navigation.navigate('PublishRoute')}
          />
        }
      />

      {/* Route actions modal */}
      <Modal
        visible={!!selectedRoute}
        onClose={() => setSelectedRoute(null)}
        title={selectedRoute ? `${selectedRoute.originAddress} → ${selectedRoute.destinationAddress}` : ''}
      >
        {selectedRoute && (
          <View style={styles.actions}>
            <Button
              title={
                selectedRoute.isActive
                  ? `${t('driver.toggleActive')}: OFF`
                  : `${t('driver.toggleActive')}: ON`
              }
              onPress={() => {
                handleToggle(selectedRoute);
                setSelectedRoute(null);
              }}
              variant="outline"
            />
            <Button
              title={t('driver.deleteRoute')}
              onPress={() => handleDelete(selectedRoute)}
              variant="outline"
              style={styles.deleteButton}
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, flexGrow: 1 },
  header: { marginBottom: spacing.md },
  eyebrow: {
    ...typography.overline,
    color: colors.textLight,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...typography.h1, color: colors.text },
  // lineHeight must follow fontSize — typography.figure fixes it at 22 for its
  // own 19px, which clips a 24px figure.
  count: { ...typography.figure, fontSize: 24, lineHeight: 30, color: colors.textLight },
  actions: { gap: spacing.md, paddingTop: spacing.md },
  deleteButton: { borderColor: colors.error },
});
