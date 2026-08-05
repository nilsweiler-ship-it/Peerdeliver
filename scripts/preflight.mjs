#!/usr/bin/env node
/**
 * Stage 0 of QA_PROTOCOL.md — toolchain and configuration checks.
 *
 * Every expensive failure on this project so far came from the environment
 * rather than the code: expo-dev-client was never installed (producing a null
 * bundler URL that looked like a network fault), the production API pointed at
 * a domain that was never registered, app.json declared no icon, and prebuild
 * was once run from the repo root and scaffolded a placeholder project.
 *
 * Each check below corresponds to one of those, so they cannot recur silently.
 * Run: npm run preflight
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

const ok = (name, detail = '') => results.push({ status: 'ok', name, detail });
const fail = (name, detail) => results.push({ status: 'fail', name, detail });
const warn = (name, detail) => results.push({ status: 'warn', name, detail });

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// 1. Native modules the app needs at runtime -------------------------------
const appPkg = readJson('packages/app/package.json');
const required = [
  'expo-dev-client',      // without it: bundler URL is null, no dev launcher
  'expo-notifications',   // push
  'expo-location',        // tracking
  'expo-task-manager',    // background tracking
];
for (const mod of required) {
  if (appPkg.dependencies?.[mod]) ok(`dependency ${mod}`, appPkg.dependencies[mod]);
  else fail(`dependency ${mod}`, 'missing — run: npx expo install ' + mod);
}

// 2. app.json essentials ----------------------------------------------------
const appJson = readJson('packages/app/app.json').expo;

appJson.icon ? ok('app icon declared', appJson.icon)
             : fail('app icon declared', 'no "icon" in app.json — iOS shows the default placeholder');

appJson.ios?.bundleIdentifier === 'ch.shlep.app'
  ? ok('iOS bundle id', appJson.ios.bundleIdentifier)
  : fail('iOS bundle id', `expected ch.shlep.app, got ${appJson.ios?.bundleIdentifier}`);

const plist = appJson.ios?.infoPlist ?? {};
plist.NSLocationWhenInUseUsageDescription
  ? ok('iOS location usage strings')
  : fail('iOS location usage strings', 'App Store review rejects builds without these');

plist.UIBackgroundModes?.includes('location')
  ? ok('iOS background location mode')
  : fail('iOS background location mode', 'background tracking dies silently without it');

// Expo's plugins normalise these to fully-qualified names, so match on the
// suffix rather than the exact string.
const androidPerms = appJson.android?.permissions ?? [];
const hasPerm = (p) => androidPerms.some((x) => x === p || x.endsWith(`.${p}`));
hasPerm('ACCESS_BACKGROUND_LOCATION') && hasPerm('FOREGROUND_SERVICE_LOCATION')
  ? ok('Android location permissions')
  : fail('Android location permissions', 'ACCESS_BACKGROUND_LOCATION + FOREGROUND_SERVICE_LOCATION required');

appJson.updates?.url
  ? ok('EAS updates configured', appJson.updates.url.slice(-12))
  : warn('EAS updates configured', 'set on first EAS build — rerun the build command once');

appJson.extra?.eas?.projectId
  ? ok('EAS projectId', appJson.extra.eas.projectId.slice(0, 8) + '…')
  : fail('EAS projectId', 'run: npx eas-cli@latest init — push tokens cannot be issued without it');

// 3. EAS can build the shared package it cannot clone -----------------------
// packages/shared/dist is gitignored, and EAS builds from a git clone. Without
// a post-install hook the shared package's `main` points at a file that does
// not exist on the build server, and Metro fails during "Bundle JavaScript"
// with no useful message.
appPkg.scripts?.['eas-build-post-install']?.includes('shared:build')
  ? ok('EAS builds shared package', 'post-install hook present')
  : fail('EAS builds shared package',
         'add "eas-build-post-install": "cd ../.. && npm run shared:build" — cloud builds fail without it');

// 4. Production API URL is a domain that exists -----------------------------
const apiSrc = readFileSync(join(root, 'packages/app/src/services/api.ts'), 'utf8');
const prodUrl = apiSrc.match(/__DEV__\s*\?[^:]+:\s*'([^']+)'/)?.[1];
prodUrl === 'https://api.shlep.ch'
  ? ok('production API URL', prodUrl)
  : fail('production API URL', `got ${prodUrl} — release builds would fail every request`);

// 4. No placeholder project at the repo root (prebuild run in the wrong dir) --
['app.json', 'ios', 'android'].some((p) => existsSync(join(root, p)))
  ? fail('no stray native project at repo root',
         'prebuild was run from the root — delete app.json/ios/android there and rerun inside packages/app')
  : ok('no stray native project at repo root');

// 5. Secrets are not committed ----------------------------------------------
try {
  const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
  const leaked = tracked.split('\n').filter((f) => /(^|\/)\.env$/.test(f));
  leaked.length ? fail('no .env tracked by git', leaked.join(', '))
                : ok('no .env tracked by git');
} catch {
  warn('git check skipped', 'not a git repo?');
}

// 6. All four locales carry the same keys ------------------------------------
try {
  const flat = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]);
  const locales = ['de', 'en', 'fr', 'it'].map((l) => ({
    l, keys: new Set(flat(readJson(`packages/app/src/i18n/locales/${l}.json`))),
  }));
  const all = new Set(locales.flatMap((x) => [...x.keys]));
  const gaps = locales.filter((x) => x.keys.size !== all.size);
  gaps.length
    ? fail('i18n keys match across languages',
           gaps.map((g) => `${g.l} missing ${all.size - g.keys.size}`).join(', '))
    : ok('i18n keys match across languages', `${all.size} keys × 4`);
} catch (e) {
  warn('i18n check skipped', e.message);
}

// ── Report ─────────────────────────────────────────────────────────────────
const icon = { ok: '\x1b[32m✓\x1b[0m', fail: '\x1b[31m✗\x1b[0m', warn: '\x1b[33m!\x1b[0m' };
console.log('\nPreflight — QA_PROTOCOL Stage 0\n' + '─'.repeat(60));
for (const r of results) {
  console.log(`${icon[r.status]} ${r.name.padEnd(38)} ${r.detail}`);
}
const failed = results.filter((r) => r.status === 'fail');
console.log('─'.repeat(60));
if (failed.length) {
  console.log(`\x1b[31m${failed.length} check(s) failed.\x1b[0m Fix these before building.\n`);
  process.exit(1);
}
console.log('\x1b[32mAll checks passed.\x1b[0m Continue to Stage 1: npm run verify\n');
