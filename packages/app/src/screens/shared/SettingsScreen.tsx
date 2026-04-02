import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.settings')}</Text>

      <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
      <View style={styles.row}>
        {(['en', 'de', 'fr'] as const).map((lang) => (
          <Button
            key={lang}
            title={lang.toUpperCase()}
            onPress={() => i18n.changeLanguage(lang)}
            variant={i18n.language === lang ? 'primary' : 'outline'}
            style={styles.langButton}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  langButton: { flex: 1 },
});
