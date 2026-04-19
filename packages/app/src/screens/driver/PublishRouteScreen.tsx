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
import { Button, Input, Card, AddressAutocomplete } from '../../components/ui';
import type { AddressSelection } from '../../components/ui';
import { useCreateRoute } from '../../queries/route';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { PackageSize, RouteType, DayOfWeek, CreateRouteInput } from '@peerdeliver/shared';

const SIZES: { key: PackageSize; label: string }[] = [
  { key: 'S', label: 'Small' },
  { key: 'M', label: 'Medium' },
  { key: 'L', label: 'Large' },
];

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return { value: i, label: `${h}:00` };
});

export function PublishRouteScreen({ navigation }: any) {
  const { t } = useTranslation();
  const createRoute = useCreateRoute();

  const [origin, setOrigin] = useState<AddressSelection | null>(null);
  const [destination, setDestination] = useState<AddressSelection | null>(null);
  const [routeType, setRouteType] = useState<RouteType>('one_time');
  const [recurringDays, setRecurringDays] = useState<DayOfWeek[]>([]);
  const [departureHour, setDepartureHour] = useState(8);
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
    if (!origin) newErrors.origin = t('common.error');
    if (!destination) newErrors.destination = t('common.error');
    if (routeType === 'recurring' && recurringDays.length === 0) newErrors.days = t('common.error');

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // Build departure time: tomorrow at selected hour for one_time,
    // or next occurrence of first selected day for recurring
    const now = new Date();
    const departure = new Date(now);
    departure.setDate(departure.getDate() + 1);
    departure.setHours(departureHour, 0, 0, 0);

    const input: CreateRouteInput = {
      originAddress: origin!.label,
      originPoint: origin!.point,
      destinationAddress: destination!.label,
      destinationPoint: destination!.point,
      routeType,
      departureTime: departure.toISOString(),
      recurringDays: routeType === 'recurring' ? recurringDays : undefined,
      availableSize,
      maxDetourMinutes: parseInt(maxDetour) || 15,
    };

    try {
      await createRoute.mutateAsync(input);
      Alert.alert(t('driver.publishSuccess'));
      navigation.navigate('MyRoutes');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Addresses */}
        <Card style={styles.section}>
          <AddressAutocomplete
            label={t('driver.originAddress')}
            onSelect={setOrigin}
            placeholder={t('sender.fromLocation')}
            error={errors.origin}
          />
          <AddressAutocomplete
            label={t('driver.destinationAddress')}
            onSelect={setDestination}
            placeholder={t('sender.toLocation')}
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

        {/* Departure time */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.departureTime')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.timeScroll}
          >
            {HOURS.map((h) => (
              <TouchableOpacity
                key={h.value}
                style={[styles.timeChip, departureHour === h.value && styles.timeChipSelected]}
                onPress={() => setDepartureHour(h.value)}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    departureHour === h.value && styles.timeChipTextSelected,
                  ]}
                >
                  {h.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  timeScroll: {
    marginHorizontal: -spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  timeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timeChipTextSelected: {
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
