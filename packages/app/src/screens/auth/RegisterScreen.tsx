import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../components/ui';
import { useRegister } from '../../queries/auth';
import { colors, spacing, typography, borderRadius } from '../../theme';

type RegisterRole = 'sender' | 'driver' | 'both';

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
  const { t } = useTranslation();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<RegisterRole>('both');
  const [licensePlate, setLicensePlate] = useState('');
  const [carModel, setCarModel] = useState('');
  const [maxLoadKg, setMaxLoadKg] = useState('');
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);

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
    register.mutate({
      email,
      password,
      firstName,
      lastName,
      role,
      ...(isDriver && licensePlate && { licensePlate }),
      ...(isDriver && carModel && { carModel }),
      ...(isDriver && maxLoadKg && { maxLoadKg: parseFloat(maxLoadKg) }),
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.register')}</Text>

        <Input label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} />
        <Input label={t('auth.lastName')} value={lastName} onChangeText={setLastName} />
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.roleLabel}>{t('auth.selectRole')}</Text>
        <View style={styles.roleRow}>
          <Button
            title={t('auth.roleSender')}
            onPress={() => setRole('sender')}
            variant={role === 'sender' ? 'primary' : 'outline'}
            style={styles.roleButton}
          />
          <Button
            title={t('auth.roleDriver')}
            onPress={() => setRole('driver')}
            variant={role === 'driver' ? 'primary' : 'outline'}
            style={styles.roleButton}
          />
        </View>
        <Button
          title={t('auth.roleBoth')}
          onPress={() => setRole('both')}
          variant={role === 'both' ? 'primary' : 'outline'}
          style={styles.bothButton}
        />

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
          </View>
        )}

        {register.error && (
          <Text style={styles.error}>
            {(register.error as any)?.response?.data?.error || t('common.error')}
          </Text>
        )}

        <Button
          title={t('auth.register')}
          onPress={handleRegister}
          loading={register.isPending}
          disabled={!email || !password || !firstName || !lastName || (isDriver && !licensePlate)}
        />

        <Button
          title={t('auth.hasAccount')}
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.secondaryButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  roleLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  roleButton: {
    flex: 1,
  },
  bothButton: {
    marginBottom: spacing.md,
  },
  vehicleSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  suggestions: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    maxHeight: 180,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  suggestionLoad: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
