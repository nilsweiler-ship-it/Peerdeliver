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
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../utils/alert';
import { parseLocaleNumber } from '../../utils/number';
import { Button, Input } from '../../components/ui';
import { BackChip, Pill } from '../../components/brand';
import { useRegister } from '../../queries/auth';
import { fonts, colors, spacing, typography, borderRadius, shadow } from '../../theme';

type RegisterRole = 'sender' | 'driver' | 'both' | 'recipient';

// Captions are translation keys (ui.capS/M/L).
const CAPACITY_OPTIONS: { key: 'S' | 'M' | 'L'; caption: string }[] = [
  { key: 'S', caption: 'ui.capS' },
  { key: 'M', caption: 'ui.capM' },
  { key: 'L', caption: 'ui.capL' },
];

// Common car models with estimated max load in kg
const CAR_SUGGESTIONS: { model: string; maxLoadKg: number }[] = [
  { model: 'VW Golf', maxLoadKg: 380 },
  { model: 'VW Polo', maxLoadKg: 310 },
  { model: 'VW Passat Variant', maxLoadKg: 580 },
  { model: 'VW Tiguan', maxLoadKg: 520 },
  { model: 'VW Transporter', maxLoadKg: 1000 },
  { model: 'Škoda Octavia Combi', maxLoadKg: 585 },
  { model: 'Škoda Fabia', maxLoadKg: 380 },
  { model: 'BMW 3er Touring', maxLoadKg: 500 },
  { model: 'Audi A4 Avant', maxLoadKg: 500 },
  { model: 'Mercedes C-Klasse T', maxLoadKg: 500 },
  { model: 'Renault Kangoo', maxLoadKg: 600 },
  { model: 'Fiat Ducato', maxLoadKg: 1500 },
  { model: 'Ford Transit', maxLoadKg: 1400 },
  { model: 'Toyota Yaris', maxLoadKg: 320 },
  { model: 'Opel Astra', maxLoadKg: 400 },
  { model: 'Bicycle / E-Bike', maxLoadKg: 15 },
  { model: 'Cargo Bike', maxLoadKg: 80 },
  { model: 'Public Transport', maxLoadKg: 20 },
];

export function RegisterScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<RegisterRole>('both');
  const [licensePlate, setLicensePlate] = useState('');
  const [carModel, setCarModel] = useState('');
  const [maxLoadKg, setMaxLoadKg] = useState('');
  const [vehicleSize, setVehicleSize] = useState<'S' | 'M' | 'L'>('L');
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);
  // Unticked by default: consent has to be an action the person takes. A
  // pre-ticked box is not consent under GDPR (recital 32) and is poor practice
  // under the Swiss nFADP.
  const [agreed, setAgreed] = useState(false);

  const isDriver = role === 'driver' || role === 'both';

  const filteredSuggestions = carModel.length >= 2
    ? CAR_SUGGESTIONS.filter((c) => c.model.toLowerCase().includes(carModel.toLowerCase()))
    : [];

  const handleSelectCar = (suggestion: { model: string; maxLoadKg: number }) => {
    setCarModel(suggestion.model);
    setMaxLoadKg(suggestion.maxLoadKg.toString());
    setShowCarSuggestions(false);
  };

  const handleRegister = () => {
    // "1'200" or "1,5" are how loads get typed here; parseFloat read them as
    // 1 and silently capped what the driver could be offered.
    const loadKg = parseLocaleNumber(maxLoadKg);
    if (isDriver && loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg <= 0 || loadKg > 2000)) {
      Alert.alert(t('common.error'), t('auth.maxLoadInvalid'));
      return;
    }
    const lang = i18n.language?.slice(0, 2);
    // Italian is a full language here (app, emails); it used to fall back to English.
    const language: 'en' | 'de' | 'fr' | 'it' =
      lang === 'de' || lang === 'fr' || lang === 'it' ? lang : 'en';
    register.mutate({
      email,
      password,
      firstName,
      lastName,
      role,
      language,
      // Sent explicitly; the server stores when and to which version.
      acceptTerms: true as const,
      ...(isDriver && licensePlate && { licensePlate }),
      ...(isDriver && carModel && { carModel }),
      ...(isDriver && loadKg !== undefined && { maxLoadKg: loadKg }),
      ...(isDriver && { vehicleSize }),
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        // The max-load field opens a numeric keypad, which on iOS has no Return
        // or Done key. Without drag-to-dismiss the keypad stays up, covers the
        // capacity cards, terms and submit button, and the form appears to stop
        // scrolling at "max load (kg)".
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <BackChip onPress={() => navigation.goBack()} />
          <Pill label={t('ui.stepOf', { n: 2, total: 2 })} mono tone="sunken" />
        </View>

        <Text style={styles.title}>{t('ui.howWillYouUse')}</Text>
        <Text style={styles.subtitle}>{t('auth.selectRole')}</Text>

        {/* Hero role cards */}
        <View style={styles.roleCards}>
          <RoleCard
            icon="package"
            iconColor={colors.primary}
            title={t('auth.roleSender')}
            caption={t('ui.senderCaption')}
            selected={role === 'sender'}
            onPress={() => setRole('sender')}
          />
          <RoleCard
            icon="truck"
            iconColor={colors.destination}
            title={t('auth.roleDriver')}
            caption={t('ui.driverCaption')}
            selected={role === 'driver'}
            onPress={() => setRole('driver')}
          />
        </View>

        {/* Secondary role options */}
        <View style={styles.roleChips}>
          <RoleChip
            label={t('auth.roleBoth')}
            selected={role === 'both'}
            onPress={() => setRole('both')}
          />
          <RoleChip
            label={t('auth.roleRecipient')}
            selected={role === 'recipient'}
            onPress={() => setRole('recipient')}
          />
        </View>

        {/* Identity fields */}
        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Input
                label={t('auth.firstName')}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.nameField}>
              <Input
                label={t('auth.lastName')}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
          />
        </View>

        {/* Driver vehicle section */}
        {isDriver && (
          <View style={styles.vehicleSection}>
            <Text style={styles.sectionTitle}>{t('auth.vehicleInfo')}</Text>
            <Input
              label={t('auth.licensePlate')}
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="ZH 123456"
              autoCapitalize="characters"
            />
            <View>
              <Input
                label={t('auth.carModel')}
                value={carModel}
                onChangeText={(text) => {
                  setCarModel(text);
                  setShowCarSuggestions(text.length >= 2);
                }}
                placeholder="e.g. VW Golf"
              />
              {showCarSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {filteredSuggestions.map((s) => (
                    <TouchableOpacity
                      key={s.model}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectCar(s)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionText}>{s.model}</Text>
                      <Text style={styles.suggestionLoad}>~{s.maxLoadKg} kg</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Input
              label={t('auth.maxLoad')}
              value={maxLoadKg}
              onChangeText={setMaxLoadKg}
              keyboardType="numeric"
              placeholder="kg"
            />

            <Text style={styles.capacityLabel}>{t('ui.howMuchCarry')}</Text>
            <View style={styles.capacityRow}>
              {CAPACITY_OPTIONS.map((o) => {
                const selected = vehicleSize === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    activeOpacity={0.85}
                    style={[styles.capacityCard, selected && styles.capacityCardSelected]}
                    onPress={() => setVehicleSize(o.key)}
                  >
                    <Text style={[styles.capacitySize, selected && styles.capacitySizeSelected]}>
                      {o.key}
                    </Text>
                    <Text style={[styles.capacityCaption, selected && styles.capacityCaptionSelected]}>
                      {t(o.caption)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Terms */}
        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, agreed && styles.checkboxOn]}
            onPress={() => setAgreed((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel={t('legal.agree')}
          >
            {agreed && <Feather name="check" size={14} color={colors.textInverse} />}
          </TouchableOpacity>
          <Text style={styles.termsText}>
            {t('legal.agree')}{' '}
            <Text style={styles.termsLink} onPress={() => navigation.navigate('LegalDoc', { doc: 'terms' })}>
              {t('settings.terms')}
            </Text>
            {'  ·  '}
            <Text style={styles.termsLink} onPress={() => navigation.navigate('LegalDoc', { doc: 'privacy' })}>
              {t('settings.privacy')}
            </Text>
          </Text>
        </View>

        {register.error && (
          <Text style={styles.error}>
            {(register.error as any)?.response?.data?.error || t('common.error')}
          </Text>
        )}

        <Button
          title={t('ui.createAccount')}
          onPress={handleRegister}
          loading={register.isPending}
          // Vehicle details are NOT required to sign up. Everyone defaults to
          // 'both', so demanding a licence plate up front would force people who
          // only want to send a parcel to invent one, or to narrow their role
          // before they know what the app does. The plate is collected when it
          // first matters — publishing a route — and verified there.
          disabled={!email || !password || !firstName || !lastName || !agreed}
          style={styles.cta}
        />

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.signinLink}
          activeOpacity={0.7}
        >
          <Text style={styles.signinText}>{t('auth.hasAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({
  icon,
  iconColor,
  title,
  caption,
  selected,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  title: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.roleCard, selected && styles.roleCardSelected]}
    >
      <View style={styles.roleCardTop}>
        <View style={[styles.roleIcon, { backgroundColor: iconColor + '18' }]}>
          <Feather name={icon} size={22} color={iconColor} />
        </View>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected && <Feather name="check" size={14} color={colors.textInverse} />}
        </View>
      </View>
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleCaption}>{caption}</Text>
    </TouchableOpacity>
  );
}

function RoleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.roleChip, selected && styles.roleChipOn]}
    >
      <Text style={[styles.roleChipText, selected && styles.roleChipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  roleCards: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadow.card,
  },
  roleCardSelected: {
    borderColor: colors.primary,
  },
  roleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleTitle: {
    ...typography.h3,
    color: colors.text,
  },
  roleCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  roleChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    ...typography.bodySmall,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.textSecondary,
  },
  roleChipTextOn: {
    color: colors.textInverse,
  },
  form: {
    marginTop: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameField: {
    flex: 1,
  },
  vehicleSection: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  capacityLabel: {
    ...typography.bodySmall,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  capacityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  capacityCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.xs,
  },
  capacityCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  capacitySize: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  capacitySizeSelected: {
    color: colors.primary,
  },
  capacityCaption: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 15,
  },
  capacityCaptionSelected: {
    color: colors.primaryDark,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    maxHeight: 180,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  suggestionLoad: {
    ...typography.bodySmall,
    fontFamily: typography.figure.fontFamily,
    color: colors.primary,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  termsLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontFamily: fonts.bodySemi,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  cta: {
    marginTop: spacing.xs,
  },
  signinLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  signinText: {
    ...typography.button,
    color: colors.primary,
  },
});
