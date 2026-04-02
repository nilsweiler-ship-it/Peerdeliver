import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../components/ui';
import { useRegister } from '../../queries/auth';
import { colors, spacing, typography } from '../../theme';

type RegisterRole = 'sender' | 'driver' | 'both';

export function RegisterScreen({ navigation }: any) {
  const { t } = useTranslation();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<RegisterRole>('both');

  const handleRegister = () => {
    register.mutate({ email, password, firstName, lastName, role });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('auth.register')}</Text>

        <Input label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} />
        <Input label={t('auth.lastName')} value={lastName} onChangeText={setLastName} />
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.roleLabel}>{t('auth.selectRole')}</Text>
        <View style={styles.roleRow}>
          <Button
            title={t('auth.roleSender')}
            onPress={() => setRole('sender')}
            variant={role === 'sender' ? 'primary' : 'outline'}
            style={styles.roleButton}
          />
          <Button
            title={t('auth.roleDriver')}
            onPress={() => setRole('driver')}
            variant={role === 'driver' ? 'primary' : 'outline'}
            style={styles.roleButton}
          />
        </View>
        <Button
          title={t('auth.roleBoth')}
          onPress={() => setRole('both')}
          variant={role === 'both' ? 'primary' : 'outline'}
          style={styles.bothButton}
        />

        {register.error && (
          <Text style={styles.error}>
            {(register.error as any)?.response?.data?.error || t('common.error')}
          </Text>
        )}

        <Button
          title={t('auth.register')}
          onPress={handleRegister}
          loading={register.isPending}
          disabled={!email || !password || !firstName || !lastName}
        />

        <Button
          title={t('auth.hasAccount')}
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.secondaryButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  roleLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  roleButton: {
    flex: 1,
  },
  bothButton: {
    marginBottom: spacing.md,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
