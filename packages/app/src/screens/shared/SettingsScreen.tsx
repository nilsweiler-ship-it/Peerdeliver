import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../../components/brand';
import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '../../i18n';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function SettingsScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as AppLanguage)
    : 'de';

  const legalRows: { key: 'terms' | 'privacy' | 'impressum'; label: string }[] = [
    { key: 'terms', label: t('settings.terms') },
    { key: 'privacy', label: t('settings.privacy') },
    { key: 'impressum', label: t('settings.impressum') },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={styles.eyebrow}>{t('settings.preferences').toUpperCase()}</Text>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <SegmentedControl
        segments={[
          { key: 'de', label: 'DE' },
          { key: 'fr', label: 'FR' },
          { key: 'it', label: 'IT' },
          { key: 'en', label: 'EN' },
        ]}
        value={current}
        onChange={(lang) => setAppLanguage(lang as AppLanguage)}
      />

      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>{t('settings.legalSection')}</Text>
      <View style={styles.list}>
        {legalRows.map((row, i) => (
          <TouchableOpacity
            key={row.key}
            style={[styles.row, i === legalRows.length - 1 && styles.rowLast]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('LegalDoc', { doc: row.key })}
          >
            <Ionicons name="document-text-outline" size={19} color={colors.primary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { ...typography.overline, color: colors.textLight, letterSpacing: 1.2, marginBottom: 2 },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  list: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { ...typography.body, color: colors.text, flex: 1 },
});
