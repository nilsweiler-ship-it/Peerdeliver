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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card, AddressAutocomplete } from '../../components/ui';
import type { AddressSelection } from '../../components/ui';
import { BackChip, RouteLine, SegmentedControl, DayPicker } from '../../components/brand';
import { useCreateRoute } from '../../queries/route';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { PackageSize, RouteType, DayOfWeek, CreateRouteInput } from '@peerdeliver/shared';

const SIZES: { key: PackageSize; label: string }[] = [
  { key: 'S', label: 'Small' },
  { key: 'M', label: 'Medium' },
  { key: 'L', label: 'Large' },
];

// DayPicker uses lowercase keys; the API/state stays uppercase DayOfWeek.
const DAY_ORDER: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const toLower = (days: DayOfWeek[]) => days.map((d) => d.toLowerCase());
const toUpper = (days: string[]) =>
  DAY_ORDER.filter((d) => days.includes(d.toLowerCase()));

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return { value: i, label: `${h}:00` };
});

const SELECTED_FILL = '#ECF1EC';

export function PublishRouteScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <BackChip onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('driver.publishRoute')}</Text>
        </View>

        {/* Addresses — RouteLine motif framing the two autocomplete fields */}
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

          {origin && destination && (
            <View style={styles.routePreview}>
              <RouteLine from={origin.label} to={destination.label} />
            </View>
          )}
        </Card>

        {/* Route type */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.routeType')}</Text>
          <SegmentedControl
            segments={[
              { key: 'one_time', label: t('driver.oneTime') },
              { key: 'recurring', label: t('driver.recurring') },
            ]}
            value={routeType}
            onChange={(key) => setRouteType(key as RouteType)}
          />

          {routeType === 'recurring' && (
            <View>
              <Text style={styles.label}>{t('driver.recurringDays')}</Text>
              <DayPicker
                value={toLower(recurringDays)}
                onChange={(days) => setRecurringDays(toUpper(days))}
              />
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
            {HOURS.map((h) => {
              const selected = departureHour === h.value;
              return (
                <TouchableOpacity
                  key={h.value}
                  activeOpacity={0.85}
                  style={[styles.timeChip, selected && styles.timeChipSelected]}
                  onPress={() => setDepartureHour(h.value)}
                >
                  <Text style={[styles.timeChipText, selected && styles.timeChipTextSelected]}>
                    {h.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {/* Capacity & Detour */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.availableSpace')}</Text>
          <View style={styles.sizeRow}>
            {SIZES.map((s) => {
              const selected = availableSize === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  activeOpacity={0.85}
                  style={[styles.sizeOption, selected && styles.sizeSelected]}
                  onPress={() => setAvailableSize(s.key)}
                >
                  <Text style={[styles.sizeLabel, selected && styles.sizeLabelSelected]}>
                    {s.key}
                  </Text>
                  <Text style={[styles.sizeDesc, selected && styles.sizeDescSelected]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label={`${t('driver.maxDetour')} (min)`}
            value={maxDetour}
            onChangeText={setMaxDetour}
            keyboardType="numeric"
            placeholder="15"
            style={styles.monoInput}
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
          title={`${t('driver.publishRoute')}  →`}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  section: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  routePreview: {
    marginTop: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.lg,
  },
  monoInput: {
    fontFamily: typography.figure.fontFamily,
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
    backgroundColor: SELECTED_FILL,
    borderColor: colors.primary,
  },
  timeChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  timeChipTextSelected: {
    ...typography.figure,
    fontSize: 14,
    color: colors.primary,
  },
  sizeRow: { flexDirection: 'row', gap: spacing.sm },
  sizeOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  sizeSelected: {
    borderColor: colors.primary,
    backgroundColor: SELECTED_FILL,
  },
  sizeLabel: { ...typography.h3, color: colors.textSecondary },
  sizeLabelSelected: { color: colors.primary },
  sizeDesc: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },
  sizeDescSelected: { color: colors.primaryDark },
  errorText: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  submitButton: { marginTop: spacing.xs },
});
