import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getLegalDoc, LEGAL_LAST_UPDATED, type LegalKey } from '../../legal/content';
import { colors, spacing, typography, borderRadius, fonts } from '../../theme';

export function LegalDocScreen({ navigation, route }: any) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const key: LegalKey = route?.params?.doc ?? 'terms';
  const doc = getLegalDoc(i18n.language, key);

  const updatedDate = new Date(LEGAL_LAST_UPDATED).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backChip} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.updated}>{t('legal.lastUpdated', { date: updatedDate })}</Text>

        <Text style={styles.intro}>{doc.intro}</Text>

        {doc.sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.h}>{s.h}</Text>
            <Text style={styles.p}>{s.p}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  backText: { ...typography.bodyStrong, color: colors.text },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  title: { ...typography.h1, fontSize: 26, color: colors.text },
  updated: { fontFamily: fonts.mono, fontSize: 12, color: colors.textLight, marginBottom: spacing.md },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  h: { ...typography.h3, color: colors.text, marginBottom: 4 },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
