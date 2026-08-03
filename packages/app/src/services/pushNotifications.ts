import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';

/**
 * Push notification registration.
 *
 * Called once the user is logged in — not at app start. A permission prompt
 * before someone has an account is asking for something they cannot yet use,
 * and iOS only lets you ask once: a decline is effectively permanent, so the
 * timing matters more than it looks.
 *
 * Everything here degrades quietly. Push is an enhancement; the app is fully
 * usable without it, and no failure should ever surface as an error.
 */

/** Foreground behaviour: show the banner rather than swallowing it silently. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push and send the token to the server.
 * Returns the token, or null if unavailable or declined.
 */
export async function registerForPush(): Promise<string | null> {
  // Simulators and web cannot receive push at all.
  if (Platform.OS === 'web' || !Constants.isDevice) return null;

  try {
    // Android needs a channel before any notification will display.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Lieferungen',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E0A32E',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    // projectId comes from app.json/EAS. Without it Expo cannot issue a token,
    // and the error it throws is not obvious — so name it explicitly.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] no EAS projectId — run `eas init` in packages/app');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    // Re-registered on every launch: Expo may rotate a token at any time, and a
    // stale one on the server means notifications silently stop arriving.
    await api.post('/users/push-token', { token }).catch(() => undefined);
    return token;
  } catch (err) {
    console.warn('[push] registration failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Drop the token server-side so a logged-out device stops receiving alerts. */
export async function unregisterPush(): Promise<void> {
  await api.delete('/users/push-token').catch(() => undefined);
}

/**
 * Wire notification taps to navigation.
 *
 * Returns an unsubscribe function — call it on unmount, or the listener leaks
 * and fires against a stale navigator.
 */
export function addNotificationTapListener(
  onTap: (data: Record<string, unknown>) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onTap(data as Record<string, unknown>);
  });
  return () => sub.remove();
}
