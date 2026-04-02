import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../../components/ui';
import { useCreateRoute } from '../../queries/route';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { PackageSize, RouteType, DayOfWeek, CreateRouteInput } from '@peerdeliver/shared';

const SIZES: { key: PackageSize; label: string }[] = [
  { key: 'S', label: 'Small' },
  { key: 'M', label: 'Medium' },
  { key: 'L', label: 'Large' },
];

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Simple geocoding for Swiss cities
const SWISS_CITIES: Record<string, { lat: number; lng: number }> = {
  zurich: { lat: 47.3769, lng: 8.5417 },
  zürich: { lat: 47.3769, lng: 8.5417 },
  bern: { lat: 46.9481, lng: 7.4474 },
  basel: { lat: 47.5596, lng: 7.5886 },
  geneva: { lat: 46.2044, lng: 6.1432 },
  genève: { lat: 46.2044, lng: 6.1432 },
  genf: { lat: 46.2044, lng: 6.1432 },
  lausanne: { lat: 46.5197, lng: 6.6323 },
  lucerne: { lat: 47.0502, lng: 8.3093 },
  luzern: { lat: 47.0502, lng: 8.3093 },
  winterthur: { lat: 47.5001, lng: 8.724 },
  lugano: { lat: 46.0037, lng: 8.9511 },
};

function geocodeCity(name: string): { lat: number; lng: number } | null {
  const key = name.toLowerCase().trim().replace(/[. ]/g, '_');
  return SWISS_CITIES[key] || null;
}

export function PublishRouteScreen({ navigation }: any) {
  const { t } = useTranslation();
  const createRoute = useCreateRoute();

  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [routeType, setRouteType] = useState<RouteType>('one_time');
  const [recurringDays, setRecurringDays] = useState<DayOfWeek[]>([]);
  const [availableSize, setAvailableSize] = useState<PackageSize>('M');
  const [maxDetour, setMaxDetour] = useState('15');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDay = (day: DayOfWeek) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!originAddress.trim()) newErrors.origin = t('common.error');
    if (!destinationAddress.trim()) newErrors.destination = t('common.error');
    if (routeType === 'recurring' && recurringDays.length === 0) newErrors.days = t('common.error');

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const originCoords = geocodeCity(originAddress);
    const destCoords = geocodeCity(destinationAddress);

    if (!originCoords || !destCoords) {
      Alert.alert(
        t('common.error'),
        'Could not find location. Try: Zurich, Bern, Basel, Geneva, Lausanne, Lucerne, Lugano',
      );
      return;
    }

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const input: CreateRouteInput = {
      originAddress,
      originPoint: originCoords,
      destinationAddress,
      destinationPoint: destCoords,
      routeType,
      departureTime: tomorrow.toISOString(),
      recurringDays: routeType === 'recurring' ? recurringDays : undefined,
      availableSize,
      maxDetourMinutes: parseInt(maxDetour) || 15,
    };

    try {
      await createRoute.mutateAsync(input);
      Alert.alert(t('driver.publishSuccess'));
      navigation.navigate('MyRoutes');
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Addresses */}
        <Card style={styles.section}>
          <Input
            label={t('driver.originAddress')}
            value={originAddress}
            onChangeText={setOriginAddress}
            placeholder="e.g. Zurich"
            error={errors.origin}
          />
          <Input
            label={t('driver.destinationAddress')}
            value={destinationAddress}
            onChangeText={setDestinationAddress}
            placeholder="e.g. Bern"
            error={errors.destination}
          />
        </Card>

        {/* Route type */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.routeType')}</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeOption, routeType === 'one_time' && styles.typeSelected]}
              onPress={() => setRouteType('one_time')}
            >
              <Text style={[styles.typeText, routeType === 'one_time' && styles.typeTextSelected]}>
                {t('driver.oneTime')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeOption, routeType === 'recurring' && styles.typeSelected]}
              onPress={() => setRouteType('recurring')}
            >
              <Text style={[styles.typeText, routeType === 'recurring' && styles.typeTextSelected]}>
                {t('driver.recurring')}
              </Text>
            </TouchableOpacity>
          </View>

          {routeType === 'recurring' && (
            <View>
              <Text style={styles.label}>{t('driver.recurringDays')}</Text>
              <View style={styles.daysRow}>
                {DAYS.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, recurringDays.includes(day) && styles.dayChipSelected]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        recurringDays.includes(day) && styles.dayChipTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.days && <Text style={styles.errorText}>{errors.days}</Text>}
            </View>
          )}
        </Card>

        {/* Capacity & Detour */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.availableSpace')}</Text>
          <View style={styles.sizeRow}>
            {SIZES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sizeOption, availableSize === s.key && styles.sizeSelected]}
                onPress={() => setAvailableSize(s.key)}
              >
                <Text
                  style={[styles.sizeLabel, availableSize === s.key && styles.sizeLabelSelected]}
                >
                  {s.key}
                </Text>
                <Text
                  style={[styles.sizeDesc, availableSize === s.key && styles.sizeDescSelected]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label={t('driver.maxDetour')}
            value={maxDetour}
            onChangeText={setMaxDetour}
            keyboardType="numeric"
            placeholder="15"
          />

          <Input
            label={t('driver.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('driver.notes')}
            multiline
          />
        </Card>

        <Button
          title={t('driver.publishRoute')}
          onPress={handleSubmit}
          loading={createRoute.isPending}
          style={styles.submitButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  section: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeOption: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  typeSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E8F5E9',
  },
  typeText: { ...typography.button, color: colors.textSecondary },
  typeTextSelected: { color: colors.primary },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayChipTextSelected: {
    color: colors.textInverse,
  },
  sizeRow: { flexDirection: 'row', gap: spacing.sm },
  sizeOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sizeSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E8F5E9',
  },
  sizeLabel: { ...typography.h2, color: colors.textSecondary },
  sizeLabelSelected: { color: colors.primary },
  sizeDesc: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },
  sizeDescSelected: { color: colors.primaryDark },
  errorText: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  submitButton: { marginTop: spacing.md },
});
