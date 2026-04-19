import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../../queries/auth';
import { Button, Card } from '../../components/ui';
import { api } from '../../services/api';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { UserRole } from '@peerdeliver/shared';

const ROLE_OPTIONS: { key: UserRole; labelKey: string }[] = [
  { key: 'sender', labelKey: 'auth.roleSender' },
  { key: 'driver', labelKey: 'auth.roleDriver' },
  { key: 'both', labelKey: 'auth.roleBoth' },
];

export function ProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useLogout();
  const [updatingRole, setUpdatingRole] = useState(false);

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

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'sender': return t('auth.roleSender');
      case 'driver': return t('auth.roleDriver');
      case 'both': return t('auth.roleBoth');
      default: return role;
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{getRoleLabel(user?.role)}</Text>
      </Card>

      <View style={styles.stats}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{user?.totalDeliveries ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.deliveryHistory')}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{(user?.co2Saved ?? 0).toFixed(1)} kg</Text>
          <Text style={styles.statLabel}>{t('profile.co2Saved')}</Text>
        </Card>
      </View>

      {/* Role switcher */}
      <Text style={styles.sectionTitle}>{t('profile.changeRole')}</Text>
      <View style={styles.roleRow}>
        {ROLE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.roleOption, user?.role === option.key && styles.roleOptionActive]}
            onPress={() => handleRoleChange(option.key)}
            disabled={updatingRole}
          >
            <Text
              style={[styles.roleOptionText, user?.role === option.key && styles.roleOptionTextActive]}
            >
              {t(option.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Location sharing toggle — drivers only */}
      {(user?.role === 'driver' || user?.role === 'both') && (
        <View style={styles.locationRow}>
          <View>
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
            thumbColor={colors.card}
          />
        </View>
      )}

      <Button
        title={t('auth.logout')}
        onPress={() => logout.mutate()}
        variant="outline"
        loading={logout.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  card: { alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.lg },
  name: { ...typography.h2, color: colors.text },
  email: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  role: { ...typography.caption, color: colors.primary, marginTop: spacing.xs, textTransform: 'uppercase', fontWeight: '600' },
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h2, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleOption: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#E8F5E9',
  },
  roleOptionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleOptionTextActive: {
    color: colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  locationLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  locationHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
