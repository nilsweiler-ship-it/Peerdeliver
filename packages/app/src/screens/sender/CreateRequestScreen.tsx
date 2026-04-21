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
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import { useStripe } from '@stripe/stripe-react-native';
import { Button, Input, Card, AddressAutocomplete } from '../../components/ui';
import type { AddressSelection } from '../../components/ui';
import { useCreateDelivery } from '../../queries/delivery';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { PackageSize, CreateDeliveryInput } from '@peerdeliver/shared';

const SIZES: { key: PackageSize; labelKey: string }[] = [
  { key: 'S', labelKey: 'sender.sizeSmall' },
  { key: 'M', labelKey: 'sender.sizeMedium' },
  { key: 'L', labelKey: 'sender.sizeLarge' },
];

export function CreateRequestScreen({ navigation }: any) {
  const { t } = useTranslation();
  const createDelivery = useCreateDelivery();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [step, setStep] = useState(0);

  // Step 0: Package details
  const [packageSize, setPackageSize] = useState<PackageSize>('S');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');

  // Step 1: Addresses
  const [pickupAddress, setPickupAddress] = useState<AddressSelection | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressSelection | null>(null);

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
    } else if (step === 2) {
      if (budget <= 0) newErrors.budget = t('common.error');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      packageDescription: description,
      packageWeight: weight ? parseFloat(weight) : undefined,
      declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
      budgetCHF: budget,
      deliveryWindowStart: tomorrow.toISOString(),
      deliveryWindowEnd: dayAfter.toISOString(),
    };

    try {
      const delivery = await createDelivery.mutateAsync(input);

      // If the server returned a Stripe clientSecret, present the Payment Sheet.
      // Without Stripe configured, clientSecret is null — we skip straight to success.
      const clientSecret = (delivery as any)?.clientSecret as string | null | undefined;
      if (clientSecret) {
        const initResult = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'PeerDeliver',
          allowsDelayedPaymentMethods: false,
        });
        if (initResult.error) {
          Alert.alert(t('common.error'), initResult.error.message);
          return;
        }
        const sheetResult = await presentPaymentSheet();
        if (sheetResult.error) {
          // User cancelled or payment failed — delivery is still created but unpaid.
          // They can retry from MyShipments (future: payment retry CTA).
          Alert.alert(t('common.error'), sheetResult.error.message);
          navigation.navigate('MyShipments');
          return;
        }
      }

      Alert.alert(t('sender.createSuccess'));
      navigation.navigate('MyShipments');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    }
  };

  const stepTitles = [
    t('sender.packageDetails'),
    t('sender.addresses'),
    t('sender.budgetAndSchedule'),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Progress indicator */}
        <View style={styles.progress}>
          {stepTitles.map((title, idx) => (
            <View key={title} style={styles.progressStep}>
              <View style={[styles.progressDot, idx <= step && styles.progressDotActive]}>
                <Text style={[styles.progressNum, idx <= step && styles.progressNumActive]}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={[styles.progressLabel, idx === step && styles.progressLabelActive]}>
                {title}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.stepIndicator}>
          {t('common.step', { current: step + 1, total: 3 })}
        </Text>

        {/* Step 0: Package Details */}
        {step === 0 && (
          <Card style={styles.stepCard}>
            <Text style={styles.sectionTitle}>{t('sender.packageSize')}</Text>
            <View style={styles.sizeRow}>
              {SIZES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.sizeOption, packageSize === s.key && styles.sizeSelected]}
                  onPress={() => setPackageSize(s.key)}
                >
                  <Text style={[styles.sizeLabel, packageSize === s.key && styles.sizeLabelSelected]}>
                    {s.key}
                  </Text>
                  <Text style={[styles.sizeDesc, packageSize === s.key && styles.sizeDescSelected]}>
                    {t(s.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={t('sender.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('sender.descriptionPlaceholder')}
              multiline
              error={errors.description}
            />

            <Input
              label={t('sender.weightEstimate')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder="0"
            />

            <Input
              label={t('sender.declaredValue')}
              value={declaredValue}
              onChangeText={setDeclaredValue}
              keyboardType="numeric"
              placeholder="0"
            />
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
                  <Text style={styles.breakdownLabel}>Platform fee (10%)</Text>
                  <Text style={styles.breakdownValue}>CHF {(budget * 0.1).toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Driver receives</Text>
                  <Text style={[styles.breakdownValue, styles.breakdownValueHighlight]}>
                    CHF {(budget * 0.9).toFixed(2)}
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
            title={step === 2 ? t('sender.createRequest') : t('common.next')}
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressNum: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressNumActive: {
    color: colors.textInverse,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  stepIndicator: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  stepCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  sizeLabel: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  sizeLabelSelected: {
    color: colors.primary,
  },
  sizeDesc: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sizeDescSelected: {
    color: colors.primaryDark,
  },
  sliderLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sliderValue: {
    ...typography.h2,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  breakdownValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
  },
  breakdownValueHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});
