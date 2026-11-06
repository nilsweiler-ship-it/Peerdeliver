import { Alert } from '../utils/alert';
import type { TFunction } from 'i18next';

/** The server's own explanation, if it sent one. */
export function apiErrorMessage(err: any): string | undefined {
  return err?.response?.data?.error || err?.message || undefined;
}

/**
 * Show a failed action to the user — and, when the server says the driver
 * must verify first, offer to take them there.
 *
 * The server refuses to let unverified drivers publish routes, claim, accept
 * or collect deliveries (code VERIFICATION_REQUIRED). A bare "Something went
 * wrong" would leave them with no idea what to do, so this turns the refusal
 * into the next step.
 */
export function showApiError(err: any, t: TFunction, navigation?: { navigate: (...args: any[]) => void }) {
  const code = err?.response?.data?.code;
  const message = apiErrorMessage(err);
  if (code === 'VERIFICATION_REQUIRED' && navigation) {
    Alert.alert(t('verification.requiredTitle'), message ?? t('verification.requiredBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('verification.verifyNow'),
        onPress: () => navigation.navigate('Profile', { screen: 'Verification' }),
      },
    ]);
    return;
  }
  Alert.alert(t('common.error'), message);
}
