import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Button, LoadingSpinner } from '../../components/ui';
import { GradientSurface, RouteWatermark, BackChip, Pill } from '../../components/brand';
import {
  useConnectStatus,
  useStartConnectOnboarding,
  useDevCompleteOnboarding,
} from '../../queries/payment';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';

const STEPS: { icon: keyof typeof Feather.glyphMap; title: string; sub: string }[] = [
  { icon: 'user-check', title: 'Verify your identity', sub: 'A quick, secure check via Stripe.' },
  { icon: 'credit-card', title: 'Add your bank account', sub: 'Your IBAN — where payouts land.' },
  { icon: 'check-circle', title: 'Start receiving payouts', sub: 'Your share arrives after each drop.' },
];

export function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { data: status, isLoading } = useConnectStatus();
  const start = useStartConnectOnboarding();
  const devComplete = useDevCompleteOnboarding();

  if (isLoading) return <LoadingSpinner />;

  const handleStart = async () => {
    try {
      const { url } = await start.mutateAsync({});
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Something went wrong', 'Could not start payout setup. Please try again.');
    }
  };

  const handleSkip = async () => {
    try {
      await devComplete.mutateAsync();
    } catch {
      Alert.alert('Something went wrong', 'Could not complete dev onboarding.');
    }
  };

  const isSimulated = status?.simulated === true;
  const isEnabled = !!status?.onboarded && !!status?.payoutsEnabled;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackChip onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Payouts</Text>
        {isSimulated && <Pill label="DEMO" tone="sunken" />}
      </View>

      {/* Hero */}
      <View style={styles.heroWrap}>
        <GradientSurface style={styles.heroGradient}>
          <RouteWatermark size={260} opacity={0.1} style={{ right: -60, top: -30 }} />
          <Text style={styles.heroOverline}>GET PAID</Text>
          <Text style={styles.heroHeadline}>
            Get paid for every delivery — your share lands after each drop.
          </Text>
        </GradientSurface>
      </View>

      {/* State 1 — simulated */}
      {isSimulated && (
        <>
          <View style={styles.card}>
            <View style={styles.successHead}>
              <View style={styles.successIcon}>
                <Feather name="check" size={22} color={colors.impact} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Payouts ready (demo mode)</Text>
                <Text style={styles.cardSub}>You're set up to receive deliveries.</Text>
              </View>
            </View>
            <Text style={styles.note}>
              Real payouts run on Stripe Connect. This build simulates them, so no bank details
              are needed — earnings are tracked for the demo.
            </Text>
          </View>
          <Button title="Done" onPress={() => navigation.goBack()} />
        </>
      )}

      {/* State 2 — real, done */}
      {!isSimulated && isEnabled && (
        <>
          <View style={styles.card}>
            <View style={styles.successHead}>
              <View style={styles.successIcon}>
                <Feather name="check" size={22} color={colors.impact} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Payouts enabled</Text>
                <Text style={styles.cardSub}>You're all set to receive payouts.</Text>
              </View>
            </View>
            <Text style={styles.note}>
              Your Stripe account is verified and connected. Earnings are paid out to your bank
              automatically.
            </Text>
          </View>
          <Button title="Done" onPress={() => navigation.goBack()} />
        </>
      )}

      {/* State 3 — real, pending */}
      {!isSimulated && !isEnabled && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set up payouts in 3 steps</Text>
            <Text style={styles.cardSub}>Takes a couple of minutes — handled securely by Stripe.</Text>
            <View style={styles.steps}>
              {STEPS.map((s, i) => (
                <View key={s.title} style={styles.step}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepIcon}>
                    <Feather name={s.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Button
            title="Set up payouts"
            onPress={handleStart}
            loading={start.isPending}
          />
          <Button
            title="Skip (dev)"
            variant="outline"
            onPress={handleSkip}
            loading={devComplete.isPending}
            style={styles.skip}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h2, color: colors.text, marginLeft: spacing.sm, flex: 1 },

  // Hero
  heroWrap: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  heroGradient: { padding: spacing.lg },
  heroOverline: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  heroHeadline: {
    ...typography.h3,
    color: colors.textInverse,
    marginTop: spacing.sm,
    lineHeight: 24,
  },

  // Card shell
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardTitle: { ...typography.h3, color: colors.text },
  cardSub: { ...typography.bodySmall, color: colors.textSecondary },
  note: { ...typography.caption, color: colors.textLight, lineHeight: 18 },

  // Success state
  successHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.impactSurface,
    borderWidth: 1,
    borderColor: colors.impactSurfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Steps
  steps: { gap: spacing.md, marginTop: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    ...typography.overline,
    fontFamily: typography.figure.fontFamily,
    color: colors.textInverse,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.impactSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { ...typography.bodyStrong, color: colors.text },
  stepSub: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },

  skip: { marginTop: -spacing.xs },
});
