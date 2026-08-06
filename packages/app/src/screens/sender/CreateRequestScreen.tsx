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
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useStripe } from '../../lib/stripe';
import { Button, Input, Card, AddressAutocomplete } from '../../components/ui';
import type { AddressSelection } from '../../components/ui';
import { Stepper, BackChip, Pill, RouteLine } from '../../components/brand';
import { useCreateDelivery } from '../../queries/delivery';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { PackageSize, Packaging, CreateDeliveryInput } from '@peerdeliver/shared';
import { estimateSize } from '@peerdeliver/shared';

const SIZES: { key: PackageSize; labelKey: string }[] = [
  { key: 'S', labelKey: 'sender.sizeSmall' },
  { key: 'M', labelKey: 'sender.sizeMedium' },
  { key: 'L', labelKey: 'sender.sizeLarge' },
];

const SELECTED_FILL = '#ECF1EC';

const PACKAGING_OPTIONS: {
  key: Packaging;
  labelKey: string;
  fallback: string;
  hint?: string;
}[] = [
  { key: 'none', labelKey: 'sender.packagingNone', fallback: 'Keine', hint: 'CO₂-ärmste Option' },
  { key: 'reused', labelKey: 'sender.packagingReused', fallback: 'Wiederverwendet' },
  { key: 'cardboard', labelKey: 'sender.packagingCardboard', fallback: 'Neuer Karton' },
  { key: 'other', labelKey: 'sender.packagingOther', fallback: 'Anderes' },
];

export function CreateRequestScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const createDelivery = useCreateDelivery();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [step, setStep] = useState(0);

  // Step 0: Package details
  const [packageSize, setPackageSize] = useState<PackageSize>('S');
  // Default to no packaging: it is the common case for a hand-to-hand handover
  // and the greener one, so it should not require an extra tap.
  const [packaging, setPackaging] = useState<Packaging>('none');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [listingText, setListingText] = useState('');
  const [autoFill, setAutoFill] = useState<ReturnType<typeof estimateSize> | null>(null);

  // Step 1: Addresses
  const [pickupAddress, setPickupAddress] = useState<AddressSelection | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressSelection | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  // Phone first: on a marketplace handover it is usually the only contact
  // detail the sender has, and an SMS is read before an email.
  const [recipientContact, setRecipientContact] = useState<'phone' | 'email'>('phone');

  // Step 2: Budget & Schedule
  const [budget, setBudget] = useState(15);
  const [instructions, setInstructions] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!description.trim()) newErrors.description = t('common.error');
    } else if (step === 1) {
      if (!pickupAddress) newErrors.pickupAddress = t('common.error');
      if (!deliveryAddress) newErrors.deliveryAddress = t('common.error');
      if (recipientContact === 'email' && recipientEmail.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
        newErrors.recipientEmail = t('common.error');
      }
      if (recipientContact === 'phone' && recipientPhone.trim() &&
          recipientPhone.replace(/\D/g, '').length < 9) {
        newErrors.recipientPhone = t('common.error');
      }
    } else if (step === 2) {
      if (budget <= 0) newErrors.budget = t('common.error');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAutoFill = () => {
    const est = estimateSize(listingText);
    setPackageSize(est.size);
    setWeight(String(est.weightKg));
    if (!description.trim()) setDescription(listingText.trim());
    setAutoFill(est);
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 2) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!pickupAddress || !deliveryAddress) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const input: CreateDeliveryInput = {
      pickupAddress,
      deliveryAddress,
      packageSize,
      packaging,
      packageDescription: description,
      packageWeight: weight ? parseFloat(weight) : undefined,
      declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
      budgetCHF: budget,
      deliveryWindowStart: tomorrow.toISOString(),
      deliveryWindowEnd: dayAfter.toISOString(),
      ...(recipientContact === 'email' && recipientEmail.trim() && {
        recipientEmail: recipientEmail.trim(),
      }),
      ...(recipientContact === 'phone' && recipientPhone.trim() && {
        recipientPhone: recipientPhone.trim(),
      }),
    };

    try {
      const delivery = await createDelivery.mutateAsync(input);
      const clientSecret = (delivery as any)?.clientSecret as string | null | undefined;

      if (clientSecret) {
        // REAL mode: confirm the Stripe TWINT PaymentIntent via the Payment Sheet
        // (TWINT app-switch). The webhook marks the delivery authorised.
        const init = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Shlep',
          allowsDelayedPaymentMethods: false,
        });
        if (init.error) {
          Alert.alert(t('common.error'), init.error.message);
          navigation.navigate('MyShipments');
          return;
        }
        const sheet = await presentPaymentSheet();
        if (sheet.error) {
          // Cancelled/failed — delivery exists but unpaid; they can retry later.
          Alert.alert(t('common.error'), sheet.error.message);
          navigation.navigate('MyShipments');
          return;
        }
        Alert.alert(t('sender.createSuccess'));
        navigation.navigate('MyShipments');
      } else {
        // SIM mode: confirm on the simulated TWINT screen.
        navigation.navigate('TwintPayment', {
          deliveryId: delivery.id,
          amountCHF: budget,
          summary: description.trim() || t('sender.delivery'),
        });
      }
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
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <BackChip onPress={() => (step > 0 ? handleBack() : navigation.goBack())} />
          <Text style={styles.title}>{t('sender.createRequest')}</Text>
          <Pill label={`${step + 1} / 3`} mono tone="sunken" />
        </View>

        {/* Stepper */}
        <Stepper steps={['Package', 'Address', 'Budget']} current={step + 1} />

        {/* Step 0: Package Details */}
        {step === 0 && (
          <Card style={styles.stepCard}>
            <View style={styles.autoFillCard}>
              <Text style={styles.autoFillLabel}>Shipping from a marketplace?</Text>
              <Input
                value={listingText}
                onChangeText={setListingText}
                placeholder="Paste the listing title or a link, e.g. 'IKEA Ektorp 2-seat sofa'"
              />
              <Button
                title="Auto-fill"
                onPress={handleAutoFill}
                variant="outline"
                style={styles.autoFillButton}
              />
              {autoFill && (
                <Text style={styles.autoFillResult}>
                  Detected: {autoFill.category} · size{' '}
                  <Text style={styles.autoFillMono}>{autoFill.size}</Text> · ~
                  <Text style={styles.autoFillMono}>{autoFill.weightKg}</Text> kg
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>{t('sender.packageSize')}</Text>
            <View style={styles.sizeRow}>
              {SIZES.map((s) => {
                const selected = packageSize === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    activeOpacity={0.85}
                    style={[styles.sizeOption, selected && styles.sizeSelected]}
                    onPress={() => setPackageSize(s.key)}
                  >
                    <Feather
                      name="package"
                      size={22}
                      color={selected ? colors.primary : colors.textLight}
                    />
                    <Text style={[styles.sizeLabel, selected && styles.sizeLabelSelected]}>
                      {s.key}
                    </Text>
                    <Text style={[styles.sizeDesc, selected && styles.sizeDescSelected]}>
                      {t(s.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Packaging feeds the CO2 figure: skipping a new box is a real
                saving over a courier shipment, and it is one of the few things
                a peer handover can offer that a parcel network cannot. */}
            <Text style={styles.sectionTitle}>{t('sender.packaging', 'Verpackung')}</Text>
            <View style={styles.packagingRow}>
              {PACKAGING_OPTIONS.map((o) => {
                const selected = packaging === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    activeOpacity={0.85}
                    style={[styles.packagingOption, selected && styles.packagingSelected]}
                    onPress={() => setPackaging(o.key)}
                  >
                    <Text
                      style={[styles.packagingLabel, selected && styles.packagingLabelSelected]}
                    >
                      {t(o.labelKey, o.fallback)}
                    </Text>
                    {!!o.hint && <Text style={styles.packagingHint}>{o.hint}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label={t('sender.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('sender.descriptionPlaceholder')}
              multiline
              error={errors.description}
            />

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Input
                  label={t('sender.weightEstimate')}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder="0"
                  style={styles.monoInput}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Input
                  label={t('sender.declaredValue')}
                  value={declaredValue}
                  onChangeText={setDeclaredValue}
                  keyboardType="numeric"
                  placeholder="0"
                  style={styles.monoInput}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Step 1: Addresses */}
        {step === 1 && (
          <Card style={styles.stepCard}>
            <AddressAutocomplete
              label={t('sender.pickupAddress')}
              onSelect={setPickupAddress}
              placeholder={t('sender.fromLocation')}
              error={errors.pickupAddress}
            />

            <AddressAutocomplete
              label={t('sender.deliveryAddress')}
              onSelect={setDeliveryAddress}
              placeholder={t('sender.toLocation')}
              error={errors.deliveryAddress}
            />

            {/* Phone or email — a sender who met someone on a marketplace
                usually has one or the other, rarely both, and a phone number
                is the more common of the two. */}
            <View style={styles.contactToggle}>
              {(['phone', 'email'] as const).map((mode) => {
                const selected = recipientContact === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.85}
                    style={[styles.contactTab, selected && styles.contactTabOn]}
                    onPress={() => setRecipientContact(mode)}
                  >
                    <Text style={[styles.contactTabText, selected && styles.contactTabTextOn]}>
                      {mode === 'phone'
                        ? t('sender.recipientPhone', 'Telefon')
                        : t('sender.recipientEmail')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {recipientContact === 'phone' ? (
              <>
                <Input
                  label={t('sender.recipientPhone', 'Telefon der empfangenden Person')}
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                  keyboardType="phone-pad"
                  placeholder="079 123 45 67"
                  error={errors.recipientPhone}
                />
                <Text style={styles.fieldHint}>
                  {t('sender.recipientPhoneHint', 'Wir schicken den Zustellcode per SMS.')}
                </Text>
              </>
            ) : (
              <>
                <Input
                  label={t('sender.recipientEmail')}
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder={t('sender.recipientEmailPlaceholder')}
                  error={errors.recipientEmail}
                />
                <Text style={styles.fieldHint}>{t('sender.recipientEmailHint')}</Text>
              </>
            )}

            {pickupAddress && deliveryAddress && (
              <View style={styles.routePreview}>
                <RouteLine from={pickupAddress.label} to={deliveryAddress.label} />
              </View>
            )}
          </Card>
        )}

        {/* Step 2: Budget & Schedule */}
        {step === 2 && (
          <Card style={styles.stepCard}>
            <View>
              <Text style={styles.sliderLabel}>{t('sender.budget')}</Text>
              <Text style={styles.sliderValue}>CHF {budget.toFixed(0)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={200}
                step={5}
                value={budget}
                onValueChange={setBudget}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <View style={styles.sliderRange}>
                <Text style={styles.sliderRangeText}>CHF 5</Text>
                <Text style={styles.sliderRangeText}>CHF 200</Text>
              </View>
              {errors.budget && <Text style={styles.sliderError}>{errors.budget}</Text>}
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('createRequestExtra.platformFee')}</Text>
                  <Text style={styles.breakdownValue}>CHF {Math.max(budget * 0.09, 1.5).toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('createRequestExtra.driverReceives')}</Text>
                  <Text style={[styles.breakdownValue, styles.breakdownValueHighlight]}>
                    CHF {(budget - Math.max(budget * 0.09, 1.5)).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            <Input
              label={t('sender.specialInstructions')}
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t('sender.specialInstructions')}
              multiline
            />
          </Card>
        )}

        {/* Navigation buttons */}
        <View style={styles.buttons}>
          {step > 0 && (
            <Button title={t('common.back')} onPress={handleBack} variant="outline" style={styles.backButton} />
          )}
          <Button
            title={step === 2 ? t('sender.createRequest') : `${t('common.next')}  →`}
            onPress={handleNext}
            loading={createDelivery.isPending}
            style={styles.nextButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    marginLeft: spacing.sm,
  },
  stepCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  autoFillCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    gap: spacing.sm,
  },
  autoFillLabel: {
    ...typography.bodySmall,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.textSecondary,
  },
  autoFillButton: {
    alignSelf: 'flex-start',
  },
  autoFillResult: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  autoFillMono: {
    fontFamily: typography.figure.fontFamily,
    color: colors.primary,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: -spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldHalf: {
    flex: 1,
  },
  monoInput: {
    fontFamily: typography.figure.fontFamily,
  },
  contactToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  contactTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  contactTabOn: {
    borderColor: colors.primary,
    backgroundColor: SELECTED_FILL,
  },
  contactTabText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  contactTabTextOn: {
    color: colors.primary,
  },
  packagingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  packagingOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  packagingSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight ?? colors.surface,
  },
  packagingLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  packagingLabelSelected: {
    color: colors.primary,
  },
  packagingHint: {
    ...typography.caption,
    color: colors.impact,
    marginTop: 2,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sizeOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sizeSelected: {
    borderColor: colors.primary,
    backgroundColor: SELECTED_FILL,
  },
  sizeLabel: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  sizeLabelSelected: {
    color: colors.primary,
  },
  sizeDesc: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
  sizeDescSelected: {
    color: colors.primaryDark,
  },
  routePreview: {
    marginTop: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.lg,
  },
  sliderLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: typography.bodyStrong.fontFamily,
    marginBottom: spacing.xs,
  },
  sliderValue: {
    ...typography.figureLg,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderRangeText: {
    ...typography.caption,
    fontFamily: typography.figure.fontFamily,
    color: colors.textLight,
  },
  sliderError: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  breakdown: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  breakdownValue: {
    ...typography.figure,
    fontSize: 15,
    color: colors.text,
  },
  breakdownValueHighlight: {
    color: colors.primary,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});
