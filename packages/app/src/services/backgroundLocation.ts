import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Background location for drivers on an active delivery.
 *
 * Why this exists: tracking used to run on a setInterval in a screen component,
 * so it died the moment the driver locked their phone or switched apps — which
 * is exactly what a driver does while driving. The sender's map would silently
 * freeze on the last position with no indication anything had stopped.
 *
 * How it works: the OS wakes a task defined here whenever the device has moved
 * far enough. That task runs in its own JS context with no React state and no
 * socket connection, so it POSTs to the API and the server fans the position
 * out over the socket to whoever is watching.
 *
 * Privacy: this only ever runs between accepting a delivery and completing it,
 * and stop() is called from every exit path. There is no ambient tracking.
 */

export const LOCATION_TASK = 'shlep-driver-location';

/**
 * Delivery ids the task should report against. Module scope is not enough — the
 * OS may relaunch the app into a headless context where this module is fresh —
 * so the ids are also persisted and reloaded by the task itself.
 */
let activeDeliveryIds: string[] = [];

const STORE_KEY = 'shlep.activeTrackedDeliveries';

const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (k: string) => localStorage.getItem(k),
      setItemAsync: async (k: string, v: string) => localStorage.setItem(k, v),
      deleteItemAsync: async (k: string) => localStorage.removeItem(k),
    }
  : require('expo-secure-store');

async function loadIds(): Promise<string[]> {
  if (activeDeliveryIds.length) return activeDeliveryIds;
  try {
    const raw = await storage.getItemAsync(STORE_KEY);
    activeDeliveryIds = raw ? JSON.parse(raw) : [];
  } catch {
    activeDeliveryIds = [];
  }
  return activeDeliveryIds;
}

async function saveIds(ids: string[]) {
  activeDeliveryIds = ids;
  try {
    if (ids.length) await storage.setItemAsync(STORE_KEY, JSON.stringify(ids));
    else await storage.deleteItemAsync(STORE_KEY);
  } catch {
    // Non-fatal: worst case the task reports nothing until the app is opened.
  }
}

// Defined at module load, as expo-task-manager requires — not inside a component.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = data?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const ids = await loadIds();
  if (!ids.length) {
    // Nothing in progress: make sure the OS isn't still waking us.
    await stopBackgroundLocation();
    return;
  }

  await Promise.all(
    ids.map((id) =>
      api
        .post(`/deliveries/${id}/location`, {
          lat: latest.coords.latitude,
          lng: latest.coords.longitude,
        })
        // A failed report is not worth retrying — a newer position is along
        // shortly and is more useful than a stale one.
        .catch(() => undefined),
    ),
  );
});

/**
 * Ask for background permission. Must be called after foreground permission has
 * been granted; both iOS and Android require that order.
 *
 * Returns false rather than throwing — background tracking is an enhancement,
 * and a driver who declines should still be able to work with foreground
 * tracking only.
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  } catch {
    return false;
  }
}

export async function startBackgroundLocation(deliveryIds: string[]): Promise<boolean> {
  if (Platform.OS === 'web' || !deliveryIds.length) return false;

  await saveIds(deliveryIds);

  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      // Report on movement, not on a timer: a driver stopped at a light or
      // parked shouldn't be draining battery for identical coordinates.
      distanceInterval: 150,
      timeInterval: 30000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Shlep — Lieferung aktiv',
        notificationBody: 'Dein Standort wird geteilt, bis die Lieferung abgeschlossen ist.',
        notificationColor: '#E0A32E',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  await saveIds([]);
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Already stopped, or the task was never registered.
  }
}
