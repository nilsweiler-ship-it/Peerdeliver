import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyRoutes, useToggleRoute, useDeleteRoute } from '../../queries/route';
import { RouteCard } from '../../components/route/RouteCard';
import { EmptyState, LoadingSpinner, Modal, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';
import type { DriverRoute } from '@peerdeliver/shared';

export function MyRoutesScreen({ navigation }: any) {
  const { t } = useTranslation();
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

  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
  list: { padding: spacing.md, flexGrow: 1 },
  actions: { gap: spacing.md, paddingTop: spacing.md },
  deleteButton: { borderColor: colors.error },
});
