import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '../../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../components/ui';
import { BackChip } from '../../components/brand';
import { useOpenDispute } from '../../queries/delivery';
import { apiErrorMessage } from '../../utils/apiError';
import { colors, spacing, typography, borderRadius } from '../../theme';

/**
 * "Report a problem" — for when something goes wrong after pickup: the parcel
 * hasn't arrived, arrived damaged, or the handover can't happen.
 *
 * Before this there was nowhere to go. The only buttons were for the happy
 * path, and the honest description of what would happen next was "the first
 * one will arrive by email and you will improvise". Opening a dispute holds
 * the money (no payout, no refund) until support has looked at the case.
 */
export function ReportProblemScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const deliveryId: string | undefined = route?.params?.deliveryId;
  const [reason, setReason] = useState('');
  const openDispute = useOpenDispute();

  const tooShort = reason.trim().length < 10;

  const submit = async () => {
    if (!deliveryId || tooShort) return;
    try {
      await openDispute.mutateAsync({ id: deliveryId, reason: reason.trim() });
      Alert.alert(t('dispute.sentTitle'), t('dispute.sentBody'));
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('common.error'), apiErrorMessage(err));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <BackChip onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('dispute.title')}</Text>
        <Text style={styles.body}>{t('dispute.intro')}</Text>

        <View style={styles.note}>
          <Feather name="shield" size={16} color={colors.signalText} />
          <Text style={styles.noteText}>{t('dispute.moneyHeld')}</Text>
        </View>

        <Input
          label={t('dispute.whatHappened')}
          value={reason}
          onChangeText={setReason}
          placeholder={t('dispute.placeholder')}
          multiline
          numberOfLines={5}
          maxLength={1000}
          style={styles.input}
        />

        <Button
          title={t('dispute.submit')}
          onPress={submit}
          loading={openDispute.isPending}
          disabled={tooShort}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.signalSoft,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  noteText: { ...typography.body, color: colors.signalText, flex: 1 },
  input: { minHeight: 120, textAlignVertical: 'top' },
  submit: { marginTop: spacing.lg },
});
