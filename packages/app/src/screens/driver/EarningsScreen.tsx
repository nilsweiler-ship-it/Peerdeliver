import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState, LoadingSpinner } from '../../components/ui';
import { useEarnings } from '../../queries/payment';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function EarningsScreen() {
  const { t } = useTranslation();
  const { data, isLoading, refetch, isRefetching } = useEarnings();

  if (isLoading) return <LoadingSpinner />;

  const deliveries = data?.deliveries ?? [];
  const pending = data?.pending ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Pending payout</Text>
        <Text style={styles.summaryValue}>CHF {pending.toFixed(2)}</Text>
        <Text style={styles.summaryHint}>Paid out weekly to your bank account</Text>
      </Card>

      {deliveries.length === 0 ? (
        <EmptyState icon="💰" title="No earnings yet" message="Completed deliveries will appear here." />
      ) : (
        deliveries.map((d) => (
          <Card key={d.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowAmount}>CHF {(d.driverPayoutCHF ?? 0).toFixed(2)}</Text>
              <Text style={[styles.statusPill, pillColor(d.paymentStatus)]}>{d.paymentStatus}</Text>
            </View>
            <Text style={styles.rowMeta}>
              Budget CHF {d.budgetCHF.toFixed(2)} · Fee CHF {(d.platformFeeCHF ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.rowDate}>{new Date(d.updatedAt).toLocaleDateString()}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function pillColor(s: string) {
  switch (s) {
    case 'captured':
      return { color: colors.primary, borderColor: colors.primary };
    case 'authorised':
      return { color: colors.warning, borderColor: colors.warning };
    case 'refunded':
    case 'voided':
    case 'failed':
      return { color: colors.error, borderColor: colors.error };
    default:
      return { color: colors.textSecondary, borderColor: colors.border };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  summaryCard: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  summaryLabel: { ...typography.bodySmall, color: colors.textSecondary },
  summaryValue: { ...typography.h1, color: colors.primary },
  summaryHint: { ...typography.caption, color: colors.textLight },
  row: { padding: spacing.md, gap: spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowAmount: { ...typography.h3, color: colors.text },
  statusPill: {
    ...typography.caption,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontWeight: '600',
  },
  rowMeta: { ...typography.bodySmall, color: colors.textSecondary },
  rowDate: { ...typography.caption, color: colors.textLight },
});
