import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.iconBadge}>
        <Feather name="mail" size={30} color={colors.primary} />
      </View>
      <Text style={styles.eyebrow}>ONE MORE STEP</Text>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.text}>Check your inbox for a verification link to finish setting up your account.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
