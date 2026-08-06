import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function VerifyEmailScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.iconBadge}>
        <Feather name="mail" size={30} color={colors.primary} />
      </View>
      <Text style={styles.eyebrow}>{t('verifyEmail.eyebrow').toUpperCase()}</Text>
      <Text style={styles.title}>{t('verifyEmail.title')}</Text>
      <Text style={styles.text}>{t('verifyEmail.text')}</Text>

      {/* This screen sits on a header-less stack and has no action of its own,
          so without this it is a dead end — reachable with no way out but
          force-quitting. Nothing currently routes here, but leaving a trap in
          place for a future navigate() call is how these bugs happen. */}
      <View style={styles.actions}>
        <Button
          title={t('common.back', 'Zurück')}
          variant="outline"
          onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate?.('Login'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.xxl,
    backgroundColor: colors.impactSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.textLight,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
