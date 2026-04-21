import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, LoadingSpinner } from '../../components/ui';
import { useConnectStatus, useStartConnectOnboarding, useDevCompleteOnboarding } from '../../queries/payment';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function OnboardingScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { data: status, isLoading, refetch } = useConnectStatus();
  const startOnboarding = useStartConnectOnboarding();
  const devComplete = useDevCompleteOnboarding();

  // When the user returns from the hosted flow, the status endpoint will sync flags via
  // stripe.accounts.retrieve. Poll once on mount and after the browser returns.
  useEffect(() => {
    refetch();
  }, []);

  const handleStart = async () => {
    try {
      const { url } = await startOnboarding.mutateAsync();
      const result = await WebBrowser.openBrowserAsync(url);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User returned — refresh status to reflect any progress.
        await refetch();
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || err?.message || String(err));
    }
  };

  const handleDevComplete = async () => {
    try {
      await devComplete.mutateAsync();
      await refetch();
      Alert.alert('Dev shortcut', 'Driver marked as onboarded (test mode).');
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || err?.message || String(err));
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const onboarded = status?.onboarded && status?.payoutsEnabled;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.title}>Get paid for deliveries</Text>
        <Text style={styles.body}>
          To accept deliveries and receive payouts, connect a Swiss bank account through Stripe.
          Stripe handles identity verification and holds your earnings until your weekly payout.
        </Text>

        {onboarded ? (
          <View style={[styles.badge, styles.badgeOk]}>
            <Text style={styles.badgeText}>✓ Payouts enabled</Text>
          </View>
        ) : status?.onboarded ? (
          <View style={[styles.badge, styles.badgeWarn]}>
            <Text style={styles.badgeText}>Onboarding in review…</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeMuted]}>
            <Text style={styles.badgeText}>Not yet onboarded</Text>
          </View>
        )}

        {!onboarded && (
          <Button
            title="Start Stripe onboarding"
            onPress={handleStart}
            loading={startOnboarding.isPending}
            style={styles.button}
          />
        )}

        {__DEV__ && !onboarded && (
          <Button
            title="Dev: skip onboarding (test mode)"
            onPress={handleDevComplete}
            loading={devComplete.isPending}
            variant="outline"
            style={styles.button}
          />
        )}

        {onboarded && (
          <Button
            title="Continue"
            onPress={() => navigation.goBack()}
            style={styles.button}
          />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.h2, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  badge: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  badgeOk: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: colors.primary },
  badgeWarn: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: colors.warning },
  badgeMuted: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  badgeText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  button: { marginTop: spacing.sm },
});
