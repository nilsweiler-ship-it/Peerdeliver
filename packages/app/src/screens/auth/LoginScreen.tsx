import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../components/ui';
import { useLogin } from '../../queries/auth';
import { colors, spacing, typography } from '../../theme';

export function LoginScreen({ navigation }: any) {
  const { t } = useTranslation();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    login.mutate({ email, password });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>PeerDeliver</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>

        <View style={styles.form}>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {login.error && (
            <Text style={styles.error}>
              {(login.error as any)?.response?.data?.error || t('common.error')}
            </Text>
          )}

          <Button
            title={t('auth.login')}
            onPress={handleLogin}
            loading={login.isPending}
            disabled={!email || !password}
          />

          <Button
            title={t('auth.noAccount')}
            onPress={() => navigation.navigate('Register')}
            variant="outline"
            style={styles.secondaryButton}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  form: {
    gap: spacing.sm,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
