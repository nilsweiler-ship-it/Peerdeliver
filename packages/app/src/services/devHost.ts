import Constants from 'expo-constants';

const PORT = 3001;
// Private LAN ranges (10/8, 192.168/16, 172.16–31/12).
const LAN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d/;

/**
 * Resolve the dev API base URL without a hardcoded IP that goes stale when the
 * Mac's DHCP lease changes.
 *
 * 0) An explicit EXPO_PUBLIC_API_URL wins over everything. Without this the
 *    LAN branch below is unconditional, so a dev build on a phone ALWAYS
 *    expects a server running on the Mac — even when the thing you want to
 *    test against is the deployed one. That failure is invisible: the request
 *    to a dead LAN address times out and the app shows its generic "etwas ist
 *    schiefgelaufen", which reads exactly like a wrong password.
 * 1) Otherwise, if Expo's dev-server host (Metro) is a LAN IP — running on a
 *    phone in LAN mode — use THAT host. It's always the Mac's current IP.
 * 2) Otherwise (simulator / web / tunnel) honor a non-LAN override in
 *    app.json `extra.apiUrl` (e.g. an ngrok/cloud URL), else localhost.
 */
export function resolveDevApiUrl(): string {
  // Set EXPO_PUBLIC_API_URL=https://api.shlep.ch in packages/app/.env.local to
  // develop against the deployed API — which is also the only way to exercise
  // Stripe webhooks, since Stripe can only call a public URL.
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    '';
  const metroHost = String(hostUri).split('/')[0].split(':')[0];
  if (metroHost && LAN.test(metroHost)) {
    return `http://${metroHost}:${PORT}`;
  }

  const override = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (override && !/localhost|127\.0\.0\.1/.test(override) && !LAN.test(override.replace(/^https?:\/\//, ''))) {
    return override;
  }
  return `http://localhost:${PORT}`;
}
