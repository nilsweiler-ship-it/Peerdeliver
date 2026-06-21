import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../../components/brand';
import { colors, spacing, typography } from '../../theme';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const current = (['en', 'de', 'fr'] as const).includes(i18n.language as any)
    ? i18n.language
    : 'en';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.eyebrow}>PREFERENCES</Text>
      <Text style={styles.title}>{t('profile.settings')}</Text>

      <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
      <SegmentedControl
        segments={[
          { key: 'en', label: 'EN' },
          { key: 'de', label: 'DE' },
          { key: 'fr', label: 'FR' },
        ]}
        value={current}
        onChange={(lang) => i18n.changeLanguage(lang)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  eyebrow: {
    ...typography.overline,
    color: colors.textLight,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
});
