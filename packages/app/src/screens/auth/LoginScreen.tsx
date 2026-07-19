import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../components/ui';
import { GradientSurface, RouteWatermark, Seal, BrandMark, CO2Chip } from '../../components/brand';
import { useLogin } from '../../queries/auth';
import { colors, spacing, typography } from '../../theme';

export function LoginScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    login.mutate({ email, password });
  };

  return (
    <GradientSurface>
      <RouteWatermark size={300} opacity={0.1} style={{ right: -70, top: -40 }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Text style={styles.est}>EST. ZÜRICH · CH</Text>
            <Seal size={36} color={colors.signal} />
          </View>

          <View style={styles.brandWrap}>
            <BrandMark onDark size={30} />
          </View>

          <View style={styles.hero}>
            <Text style={styles.headline}>Send it with someone already going there.</Text>
            <Text style={styles.subcopy}>
              Send greener. Earn on the side. On your schedule.
            </Text>
            <CO2Chip label="LOW-CARBON BY DESIGN" onDark style={styles.pill} />
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              monoLabel
              tone="glass"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              monoLabel
              tone="glass"
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
              variant="light"
              loading={login.isPending}
              disabled={!email || !password}
              style={styles.loginButton}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.createLink}
              activeOpacity={0.7}
            >
              <Text style={styles.createText}>{t('auth.noAccount')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientSurface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  est: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  brandWrap: {
    marginTop: spacing.xl,
  },
  hero: {
    marginTop: spacing.lg,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  headline: {
    fontFamily: typography.display.fontFamily,
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1,
    color: colors.textInverse,
  },
  subcopy: {
    ...typography.body,
    color: 'rgba(255,255,255,0.62)',
    marginTop: spacing.md,
  },
  pill: {
    marginTop: spacing.lg,
  },
  form: {
    gap: spacing.xs,
  },
  error: {
    ...typography.bodySmall,
    color: '#F4B59C',
    marginBottom: spacing.sm,
  },
  loginButton: {
    marginTop: spacing.sm,
  },
  createLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  createText: {
    ...typography.button,
    color: colors.signal,
  },
});
