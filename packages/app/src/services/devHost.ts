import Constants from 'expo-constants';

const PORT = 3001;
// Private LAN ranges (10/8, 192.168/16, 172.16–31/12).
const LAN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d/;

/**
 * Resolve the dev API base URL without a hardcoded IP that goes stale when the
 * Mac's DHCP lease changes.
 *
 * 1) If Expo's dev-server host (Metro) is a LAN IP — i.e. running on a phone in
 *    LAN mode — use THAT host. It's always the Mac's current IP.
 * 2) Otherwise (simulator / web / tunnel) honor an explicit non-LAN override in
 *    app.json `extra.apiUrl` (e.g. an ngrok/cloud URL), else fall back to localhost.
 */
export function resolveDevApiUrl(): string {
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
