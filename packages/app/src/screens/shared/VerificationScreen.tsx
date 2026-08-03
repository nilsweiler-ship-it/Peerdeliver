import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import {
  useVerify,
  useDevVerifyAll,
  useStartPhoneVerification,
  useCheckPhoneVerification,
} from '../../queries/verification';
import { Button, Input, Badge } from '../../components/ui';
import { BackChip } from '../../components/brand';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';

function serverError(err: any): string | undefined {
  return err?.response?.data?.error;
}

export function VerificationScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const verify = useVerify();
  const devVerify = useDevVerifyAll();
  const startPhone = useStartPhoneVerification();
  const checkPhone = useCheckPhoneVerification();

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [plate, setPlate] = useState(user?.licensePlate ?? '');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [plateError, setPlateError] = useState<string | undefined>();

  // Phone verification is two steps: request a code, then enter it. `sentTo`
  // holds the server-normalised E.164 number and doubles as the "code sent"
  // flag — it must be echoed back exactly or Twilio can't match the request.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState('');

  const isDriver = user?.role === 'driver' || user?.role === 'both';
  const isVerified = user?.verificationStatus === 'verified';

  // ── Trust score (Email is implicitly verified for a logged-in user) ──
  const checks = [
    true, // email
    !!user?.phoneVerified,
    !!user?.idVerified,
    ...(isDriver ? [!!user?.plateVerified] : []),
  ];
  const done = checks.filter(Boolean).length;
  const total = checks.length;

  const handleSendCode = async () => {
    setPhoneError(undefined);
    try {
      const res = await startPhone.mutateAsync({ phone, language: i18n.language?.slice(0, 2) });
      setSentTo(res.phone);
      setSmsCode('');
    } catch (err: any) {
      setPhoneError(serverError(err) ?? t('more.phoneError'));
    }
  };

  const handleCheckCode = async () => {
    setPhoneError(undefined);
    try {
      await checkPhone.mutateAsync({ phone: sentTo!, code: smsCode });
      setSentTo(null);
      setSmsCode('');
    } catch (err: any) {
      setPhoneError(serverError(err) ?? t('more.phoneError'));
    }
  };

  const handleVerifyId = async () => {
    try {
      await verify.mutateAsync({ type: 'id' });
    } catch (err: any) {
      Alert.alert('Verification failed', serverError(err) ?? 'Could not verify your identity.');
    }
  };

  const handleVerifyPlate = async () => {
    setPlateError(undefined);
    try {
      await verify.mutateAsync({ type: 'plate', value: plate });
    } catch (err: any) {
      setPlateError(serverError(err) ?? t('more.plateError'));
    }
  };

  const handleDevVerify = async () => {
    try {
      await devVerify.mutateAsync();
    } catch (err: any) {
      Alert.alert('Dev verify failed', serverError(err) ?? 'Something went wrong.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Header */}
      <View style={styles.header}>
        <BackChip onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('verification.title')}</Text>
      </View>

      {/* Hero trust summary */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Text style={styles.heroOverline}>{t('verification.trustScore').toUpperCase()}</Text>
            <Text style={styles.heroScore}>
              {done} / {total} <Text style={styles.heroScoreUnit}>verified</Text>
            </Text>
          </View>
          {isVerified ? (
            <Badge label={t('ui.verified').toUpperCase()} variant="success" />
          ) : (
            <View style={styles.getVerified}>
              <Feather name="shield" size={13} color={colors.primary} />
              <Text style={styles.getVerifiedText}>{t('verification.getVerified')}</Text>
            </View>
          )}
        </View>
        <View style={styles.heroTrack}>
          <View
            style={[styles.heroFill, { width: `${Math.round((done / total) * 100)}%` }]}
          />
        </View>
        <Text style={styles.heroHint}>
          Verified drivers get more deliveries and build a safer network.
        </Text>
      </View>

      {/* Checklist */}
      <Text style={styles.sectionTitle}>{t('verification.trustSignals')}</Text>

      {/* 1. Email */}
      <TrustItem icon="mail" title={t('verification.email')} verified>
        <Text style={styles.itemValue} numberOfLines={1}>
          {user?.email}
        </Text>
      </TrustItem>

      {/* 2. Phone */}
      <TrustItem
        icon="phone"
        title={t('verification.phone')}
        verified={!!user?.phoneVerified}
        verifiedValue={user?.phone}
      >
        {!user?.phoneVerified && !sentTo && (
          <View style={styles.action}>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder={t('verification.phonePlaceholder')}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={phoneError}
              style={styles.input}
            />
            <Button
              title={t('verification.sendCode', 'Code senden')}
              onPress={handleSendCode}
              loading={startPhone.isPending}
              disabled={!phone.trim()}
            />
            <Text style={styles.caption}>{t('verification.oneTimeCode')}</Text>
          </View>
        )}

        {!user?.phoneVerified && sentTo && (
          <View style={styles.action}>
            <Text style={styles.caption}>
              {t('verification.codeSentTo', 'Code gesendet an')} {sentTo}
            </Text>
            <Input
              value={smsCode}
              onChangeText={setSmsCode}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="sms-otp"
              maxLength={10}
              error={phoneError}
              style={styles.input}
            />
            <Button
              title={t('verification.verify')}
              onPress={handleCheckCode}
              loading={checkPhone.isPending}
              disabled={smsCode.trim().length < 4}
            />
            <Button
              title={t('verification.changeNumber', 'Nummer ändern')}
              variant="outline"
              onPress={() => {
                setSentTo(null);
                setSmsCode('');
                setPhoneError(undefined);
              }}
            />
          </View>
        )}
      </TrustItem>

      {/* 3. Identity */}
      <TrustItem icon="user-check" title={t('verification.identity')} verified={!!user?.idVerified}>
        {!user?.idVerified && (
          <View style={styles.action}>
            <Button
              title={t('verification.verifyIdentity')}
              onPress={handleVerifyId}
              loading={verify.isPending}
            />
            <Text style={styles.caption}>
              Photo ID check — simulated in this build (production would use a KYC provider).
            </Text>
          </View>
        )}
      </TrustItem>

      {/* 4. Licence plate (drivers only) */}
      {isDriver && (
        <TrustItem
          icon="truck"
          title={t('verification.plate')}
          verified={!!user?.plateVerified}
          verifiedValue={user?.licensePlate}
        >
          {!user?.plateVerified && (
            <View style={styles.action}>
              <Input
                value={plate}
                onChangeText={(v) => setPlate(v.toUpperCase())}
                placeholder={t('register.platePlaceholder')}
                autoCapitalize="characters"
                error={plateError}
                style={styles.input}
              />
              <Button
                title={t('verification.verifyPlate')}
                onPress={handleVerifyPlate}
                loading={verify.isPending}
                disabled={!plate.trim()}
              />
              <Text style={styles.caption}>
                Swiss plate format check. Real registry authentication requires a licensed
                vehicle-data provider.
              </Text>
            </View>
          )}
        </TrustItem>
      )}

      {/* Dev helper */}
      <View style={styles.dev}>
        <Button
          title="Verify everything (dev)"
          variant="outline"
          onPress={handleDevVerify}
          loading={devVerify.isPending}
        />
        <Text style={styles.devCaption}>
          Development shortcut — instantly verifies every signal for testing.
        </Text>
      </View>
    </ScrollView>
  );
}

function TrustItem({
  icon,
  title,
  verified,
  verifiedValue,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  verified?: boolean;
  /** mono value shown next to the Verified pill (phone, plate). */
  verifiedValue?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <View style={[styles.itemIcon, verified && styles.itemIconDone]}>
          <Feather name={icon} size={18} color={verified ? colors.impact : colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.itemTitle}>{title}</Text>
          {verified && verifiedValue ? (
            <Text style={styles.itemMono}>{verifiedValue}</Text>
          ) : null}
        </View>
        {verified ? (
          <View style={styles.verifiedPill}>
            <Feather name="check" size={13} color={colors.impact} />
            <Text style={styles.verifiedText}>{t('verification.verified')}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typography.h2, color: colors.text, flex: 1 },

  // Hero
  hero: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroOverline: {
    ...typography.overline,
    color: colors.textLight,
    letterSpacing: 1.5,
  },
  heroScore: {
    ...typography.figureLg,
    color: colors.text,
    marginTop: 4,
  },
  heroScoreUnit: {
    ...typography.body,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
  },
  getVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.impactSurface,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  getVerifiedText: {
    ...typography.caption,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  heroTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: colors.impact },
  heroHint: { ...typography.bodySmall, color: colors.textSecondary },

  // Section
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.xs },

  // Trust item
  item: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconDone: { backgroundColor: colors.impactSurface },
  itemTitle: { ...typography.bodyStrong, color: colors.text },
  itemMono: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemValue: {
    ...typography.bodySmall,
    fontFamily: typography.figure.fontFamily,
    color: colors.textSecondary,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.impactSurface,
    borderWidth: 1,
    borderColor: colors.impactSurfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verifiedText: {
    ...typography.caption,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.impact,
  },

  // Action area inside an item
  action: { gap: spacing.sm },
  input: { marginBottom: 0 },
  caption: { ...typography.caption, color: colors.textLight },

  // Dev helper
  dev: { marginTop: spacing.sm, gap: spacing.sm },
  devCaption: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
});
