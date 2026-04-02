import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../../theme';

export function RatingsScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.ratings')}</Text>
      <Text style={styles.text}>TODO: List of ratings received and given</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  text: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
