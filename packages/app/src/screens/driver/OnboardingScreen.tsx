import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { Button, LoadingSpinner } from '../../components/ui';
import { GradientSurface, RouteWatermark, BackChip, Pill } from '../../components/brand';
import {
  useConnectStatus,
  useStartConnectOnboarding,
  useDevCompleteOnboarding,
} from '../../queries/payment';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';

const STEP_ICONS: (keyof typeof Feather.glyphMap)[] = ['user-check', 'credit-card', 'check-circle'];

export function OnboardingScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: status, isLoading } = useConnectStatus();
  const start = useStartConnectOnboarding();
  const devComplete = useDevCompleteOnboarding();

  if (isLoading) return <LoadingSpinner />;

  const handleStart = async () => {
    try {
      const { url } = await start.mutateAsync({});
      await WebBrowser.openBrowserAsync(url);
    } catch (err: any) {
      // Show what the server actually said. "Please try again" hid a failure
      // that no amount of trying could fix: the account link was being created
      // with a custom-scheme return URL, which Stripe rejects outright.
      const detail =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Unknown error';
      Alert.alert(t('payoutSetup.failed'), String(detail));
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
        <Text style={styles.title}>{t('payoutSetup.title')}</Text>
        {isSimulated && <Pill label="DEMO" tone="sunken" />}
      </View>

      {/* Hero */}
      <View style={styles.heroWrap}>
        <GradientSurface style={styles.heroGradient}>
          <RouteWatermark size={260} opacity={0.1} style={{ right: -60, top: -30 }} />
          <Text style={styles.heroOverline}>{t('payoutSetup.heroOverline')}</Text>
          <Text style={styles.heroHeadline}>{t('payoutSetup.heroHeadline')}</Text>
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
                <Text style={styles.cardTitle}>{t('payoutSetup.demoTitle')}</Text>
                <Text style={styles.cardSub}>{t('payoutSetup.demoSub')}</Text>
              </View>
            </View>
            <Text style={styles.note}>{t('payoutSetup.demoNote')}</Text>
          </View>
          <Button title={t('common.done')} onPress={() => navigation.goBack()} />
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
                <Text style={styles.cardTitle}>{t('payoutSetup.doneTitle')}</Text>
                <Text style={styles.cardSub}>{t('payoutSetup.doneSub')}</Text>
              </View>
            </View>
            <Text style={styles.note}>{t('payoutSetup.doneNote')}</Text>
          </View>
          <Button title={t('common.done')} onPress={() => navigation.goBack()} />
        </>
      )}

      {/* State 3 — real, pending */}
      {!isSimulated && !isEnabled && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('payoutSetup.cardTitle')}</Text>
            <Text style={styles.cardSub}>{t('payoutSetup.cardSub')}</Text>
            <View style={styles.steps}>
              {STEP_ICONS.map((icon, i) => (
                <View key={icon} style={styles.step}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepIcon}>
                    <Feather name={icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.stepTitle}>{t(`payoutSetup.step${i + 1}Title`)}</Text>
                    <Text style={styles.stepSub}>{t(`payoutSetup.step${i + 1}Sub`)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* The two questions a driver actually has at this moment, answered
              before they have to ask. "Why not TWINT" is the first thing a
              Swiss user thinks when told to supply an IBAN, and "who sees
              this" is the reason they hesitate. Leaving both unanswered on the
              screen where they decide is where drivers are lost. */}
          <View style={styles.card}>
            <View style={styles.qaHead}>
              <Feather name="help-circle" size={17} color={colors.textSecondary} />
              <Text style={styles.qaTitle}>{t('payoutSetup.whyTitle')}</Text>
            </View>
            <Text style={styles.note}>{t('payoutSetup.whyBody')}</Text>

            <View style={[styles.qaHead, styles.qaSecond]}>
              <Feather name="lock" size={17} color={colors.textSecondary} />
              <Text style={styles.qaTitle}>{t('payoutSetup.privacyTitle')}</Text>
            </View>
            <Text style={styles.note}>{t('payoutSetup.privacyBody')}</Text>
          </View>

          <Button
            title={t('payoutSetup.cta')}
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

  qaHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  qaSecond: { marginTop: spacing.sm },
  qaTitle: { ...typography.bodyStrong, color: colors.text, flex: 1 },

  skip: { marginTop: -spacing.xs },
});
