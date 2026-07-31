import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../../queries/auth';
import { Badge } from '../../components/ui';
import { GradientSurface, RouteWatermark, LeafMark, SegmentedControl, GrowthAvatar, growthStage } from '../../components/brand';
import { api } from '../../services/api';
import { colors, spacing, typography, borderRadius, shadow } from '../../theme';
import type { UserRole } from '@peerdeliver/shared';

const ROLE_OPTIONS: { key: UserRole; labelKey: string }[] = [
  { key: 'sender', labelKey: 'auth.roleSender' },
  { key: 'driver', labelKey: 'auth.roleDriver' },
  { key: 'both', labelKey: 'auth.roleBoth' },
  { key: 'recipient', labelKey: 'auth.roleRecipient' },
];

export function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useLogout();
  const [updatingRole, setUpdatingRole] = useState(false);
  const isDriver = user?.role === 'driver' || user?.role === 'both';

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === user?.role) return;
    setUpdatingRole(true);
    try {
      const { data } = await api.patch('/users/profile', { role: newRole });
      setUser({ ...user!, role: newRole });
      Alert.alert(t('profile.roleUpdated'));
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setUpdatingRole(false);
    }
  };

  // ── Derived figures for the impact card ─────────────────
  const co2Saved = user?.co2Saved ?? 0;
  const totalDeliveries = user?.totalDeliveries ?? 0;
  const carTrips = Math.max(0, Math.round(co2Saved / 1.6));
  const kmShared = Math.round(co2Saved / 0.12); // ~120 g CO₂ / km saved
  const peopleConnected = totalDeliveries; // one person connected per delivery
  const rating = user?.averageRating ? user.averageRating.toFixed(1) : 'N/A';
  const memberYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : '';
  const isVerified = user?.verificationStatus === 'verified';
  const stage = growthStage(co2Saved);
  const toNext = stage.next ? Math.max(0, stage.next.min - co2Saved) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <GrowthAvatar co2={co2Saved} size={64} />
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.meta}>
            ★ {rating} · {t('more.memberSince', { year: memberYear })}
          </Text>
          <View style={styles.stagePill}>
            <LeafMark size={11} color={colors.impact} />
            <Text style={styles.stageText}>{t('growth.' + stage.index)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.gear} activeOpacity={0.7}>
          <Feather name="settings" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Growth progress */}
      <View style={styles.growthCard}>
        <View style={styles.growthHead}>
          <Text style={styles.growthName}>{t('growth.' + stage.index)}</Text>
          <Text style={styles.growthNext}>
            {stage.next ? t('more.toNext', { kg: toNext.toFixed(1), name: t('growth.' + stage.next.index) }) : t('more.fullyGrown')}
          </Text>
        </View>
        <View style={styles.growthTrack}>
          <View style={[styles.growthFill, { width: `${Math.round(stage.progress * 100)}%` }]} />
        </View>
        <Text style={styles.growthHint}>{t('profileExtra.treeGrows')}</Text>
      </View>

      {/* Role — primary sender/driver toggle */}
      <Text style={styles.sectionTitle}>{t('profile.changeRole')}</Text>
      <SegmentedControl
        segments={[
          { key: 'sender', label: t('auth.roleSender') },
          { key: 'driver', label: t('auth.roleDriver') },
        ]}
        value={user?.role === 'driver' ? 'driver' : 'sender'}
        onChange={(key) => handleRoleChange(key as UserRole)}
      />
      <View style={styles.roleRow}>
        {ROLE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.roleChip, user?.role === option.key && styles.roleChipActive]}
            onPress={() => handleRoleChange(option.key)}
            disabled={updatingRole}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleChipText, user?.role === option.key && styles.roleChipTextActive]}>
              {t(option.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LIFETIME IMPACT */}
      <View style={styles.impactWrap}>
        <GradientSurface style={styles.impactGradient}>
          <RouteWatermark size={240} opacity={0.1} style={{ right: -50, top: -20 }} />
          <View style={styles.impactHead}>
            <LeafMark size={16} color={colors.impactLeaf} />
            <Text style={styles.impactOverline}>{t('profileExtra.lifetimeImpact').toUpperCase()}</Text>
          </View>
          <Text style={styles.impactAmount}>{co2Saved.toFixed(1)} kg</Text>
          <Text style={styles.impactSub}>{t('more.carTrips', { count: carTrips })}</Text>
          <View style={styles.impactStats}>
            <View style={styles.impactStat}>
              <Text style={styles.impactStatValue}>{totalDeliveries}</Text>
              <Text style={styles.impactStatLabel}>{t('profileExtra.deliveries')}</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <Text style={styles.impactStatValue}>{kmShared}</Text>
              <Text style={styles.impactStatLabel}>{t('more.kmShared')}</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <Text style={styles.impactStatValue}>{peopleConnected}</Text>
              <Text style={styles.impactStatLabel}>{t('profileExtra.peopleConnected')}</Text>
            </View>
          </View>
        </GradientSurface>
      </View>

      {/* Location sharing toggle — drivers only */}
      {(user?.role === 'driver' || user?.role === 'both') && (
        <View style={styles.locationRow}>
          <View style={styles.flex}>
            <Text style={styles.locationLabel}>{t('profile.shareLocation')}</Text>
            <Text style={styles.locationHint}>{t('profile.shareLocationHint')}</Text>
          </View>
          <Switch
            value={user?.shareLocation !== false}
            onValueChange={async (val) => {
              try {
                await api.patch('/users/profile', { shareLocation: val });
                setUser({ ...user!, shareLocation: val });
              } catch {
                Alert.alert(t('common.error'));
              }
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      )}

      {/* Settings list */}
      <View style={styles.settingsList}>
        {isDriver && (
          <>
            <SettingsRow
              icon="credit-card"
              label={t('profileExtra.earningsPayouts')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'Earnings' })}
            />
            <SettingsRow
              icon="dollar-sign"
              label={t('profileExtra.payoutSetup')}
              onPress={() => navigation.navigate('DriverStack', { screen: 'PayoutOnboarding' })}
            />
          </>
        )}
        <SettingsRow
          icon="shield"
          label={t('profileExtra.verificationTrust')}
          onPress={() => navigation.navigate('Verification')}
          trailing={isVerified ? <Badge label={t('ui.verified').toUpperCase()} variant="success" /> : undefined}
        />
        <SettingsRow
          icon="settings"
          label={t('settings.title')}
          onPress={() => navigation.navigate('Settings')}
        />
        <SettingsRow
          icon="file-text"
          label={t('profile.legal')}
          onPress={() => navigation.navigate('LegalDoc', { doc: 'terms' })}
        />
        <SettingsRow
          icon="help-circle"
          label={t('profileExtra.helpSupport')}
          onPress={() => navigation.navigate('HelpSupport')}
          last
        />
      </View>

      {/* Log out */}
      <TouchableOpacity
        style={styles.logout}
        onPress={() => logout.mutate()}
        disabled={logout.isPending}
        activeOpacity={0.85}
      >
        <Feather name="log-out" size={18} color={colors.textInverse} />
        <Text style={styles.logoutText}>{t('auth.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  trailing,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  last?: boolean;
}) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.settingsRow, !last && styles.settingsRowBorder]}
    >
      <View style={styles.settingsIcon}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.settingsLabel}>{label}</Text>
      {trailing ?? <Feather name="chevron-right" size={20} color={colors.textLight} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerInfo: { flex: 1 },
  name: { ...typography.h2, color: colors.text },
  meta: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    color: colors.textSecondary,
    marginTop: 4,
  },
  gear: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.impactSurface,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  stageText: {
    ...typography.caption,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.impact,
  },

  // Growth progress
  growthCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  growthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  growthName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  growthNext: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    color: colors.impact,
  },
  growthTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  growthFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.impact,
  },
  growthHint: {
    ...typography.caption,
    color: colors.textLight,
  },

  // Role
  sectionTitle: { ...typography.h3, color: colors.text },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.impactSurface,
  },
  roleChipText: {
    ...typography.bodySmall,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.textSecondary,
  },
  roleChipTextActive: {
    color: colors.primary,
  },

  // Impact card
  impactWrap: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  impactGradient: { padding: spacing.lg },
  impactHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  impactOverline: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  impactAmount: {
    ...typography.figureLg,
    color: colors.impactOnDark,
    marginTop: spacing.sm,
  },
  impactSub: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
  },
  impactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  impactStat: { flex: 1, alignItems: 'center' },
  impactStatValue: {
    ...typography.figure,
    color: colors.textInverse,
  },
  impactStatLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  impactDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  // Location row
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  locationLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  locationHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Settings list
  settingsList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.impactSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },

  // Logout
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destination,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    minHeight: 52,
    marginTop: spacing.xs,
  },
  logoutText: {
    ...typography.button,
    color: colors.textInverse,
  },
});
