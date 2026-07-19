import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BackChip, Pill } from '../../components/brand';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';

const APP_VERSION = 'Shlep · v0.1.0';

const TONE_MAP = {
  spruce: { bg: colors.impactSurface, fg: colors.primary },
  signal: { bg: colors.signalSoft, fg: colors.signalText },
  destination: { bg: '#F6E2D8', fg: colors.destination },
};

export function HelpSupportScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ── Quick-contact cards ──────────────────────────────────
  const CONTACT_CARDS: {
    key: string;
    icon: keyof typeof Feather.glyphMap;
    label: string;
    hint: string;
    tone: 'spruce' | 'signal' | 'destination';
    action: () => void;
  }[] = [
    {
      key: 'email',
      icon: 'mail',
      label: t('help.emailUs'),
      hint: 'support@shlep.ch',
      tone: 'spruce',
      action: () => Linking.openURL('mailto:support@shlep.ch'),
    },
    {
      key: 'report',
      icon: 'alert-triangle',
      label: t('help.reportProblem'),
      hint: t('help.reportHint'),
      tone: 'signal',
      action: () => Linking.openURL('mailto:support@shlep.ch?subject=Problem%20report'),
    },
    {
      key: 'safety',
      icon: 'shield',
      label: t('help.safety'),
      hint: t('help.safetyHint'),
      tone: 'destination',
      action: () =>
        Alert.alert(
          t('help.safetyTitle'),
          t('help.safetyBody'),
          [
            { text: t('ui.close'), style: 'cancel' },
            { text: t('help.emailSupport'), onPress: () => Linking.openURL('mailto:support@shlep.ch?subject=Safety%20concern') },
          ],
        ),
    },
  ];

  // ── FAQ ──────────────────────────────────────────────────
  const FAQS: { q: string; a: string }[] = [
    { q: t('help.q1'), a: t('help.a1') },
    { q: t('help.q2'), a: t('help.a2') },
    { q: t('help.q3'), a: t('help.a3') },
    { q: t('help.q4'), a: t('help.a4') },
    { q: t('help.q5'), a: t('help.a5') },
    { q: t('help.q6'), a: t('help.a6') },
    { q: t('help.q7'), a: t('help.a7') },
    { q: t('help.q8'), a: t('help.a8') },
  ];

  // ── Resources ────────────────────────────────────────────
  const RESOURCES: {
    key: string;
    icon: keyof typeof Feather.glyphMap;
    label: string;
    url?: string;
  }[] = [
    { key: 'community', icon: 'users', label: t('help.community'), url: 'https://shlep.ch/community' },
    { key: 'terms', icon: 'file-text', label: t('help.terms'), url: 'https://shlep.ch/terms' },
    { key: 'privacy', icon: 'lock', label: t('help.privacy'), url: 'https://shlep.ch/privacy' },
    { key: 'trust', icon: 'shield', label: t('help.trust'), url: 'https://shlep.ch/trust' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackChip onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('help.title')}</Text>
          <Pill label={t('help.faqPill')} tone="sunken" />
        </View>

        {/* ── Quick contact ── */}
        <Text style={styles.sectionTitle}>{t('help.quickContact')}</Text>
        <View style={styles.contactRow}>
          {CONTACT_CARDS.map((c) => {
            const tone = TONE_MAP[c.tone];
            return (
              <TouchableOpacity
                key={c.key}
                style={styles.contactCard}
                activeOpacity={0.85}
                onPress={c.action}
              >
                <View style={[styles.contactIcon, { backgroundColor: tone.bg }]}>
                  <Feather name={c.icon} size={18} color={tone.fg} />
                </View>
                <Text style={styles.contactLabel}>{c.label}</Text>
                <Text style={styles.contactHint} numberOfLines={2}>
                  {c.hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── FAQ ── */}
        <Text style={styles.sectionTitle}>{t('help.frequentlyAsked')}</Text>
        <View style={styles.faqList}>
          {FAQS.map((item, i) => {
            const open = openFaq === i;
            return (
              <View key={item.q} style={[styles.faqItem, i < FAQS.length - 1 && styles.faqItemBorder]}>
                <TouchableOpacity
                  style={styles.faqHead}
                  activeOpacity={0.7}
                  onPress={() => setOpenFaq(open ? null : i)}
                >
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Feather
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={open ? colors.primary : colors.textLight}
                  />
                </TouchableOpacity>
                {open && <Text style={styles.faqAnswer}>{item.a}</Text>}
              </View>
            );
          })}
        </View>

        {/* ── Resources ── */}
        <Text style={styles.sectionTitle}>{t('help.resources')}</Text>
        <View style={styles.resourceList}>
          {RESOURCES.map((r, i) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.resourceRow, i < RESOURCES.length - 1 && styles.resourceRowBorder]}
              activeOpacity={0.7}
              onPress={() => r.url && Linking.openURL(r.url)}
            >
              <View style={styles.resourceIcon}>
                <Feather name={r.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.resourceLabel}>{r.label}</Text>
              <Feather name="external-link" size={17} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.version}>{APP_VERSION}</Text>
          <Text style={styles.madeIn}>{t('help.madeIn')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
  },

  // Section titles
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.sm,
  },

  // Quick contact
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  contactIcon: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.text,
  },
  contactHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // FAQ
  faqList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  faqItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  faqQuestion: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  faqAnswer: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 21,
  },

  // Resources
  resourceList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  resourceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.impactSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },

  // Footer
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  version: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    color: colors.textLight,
  },
  madeIn: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
