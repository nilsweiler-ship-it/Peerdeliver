#!/usr/bin/env node
/**
 * Create the test accounts the manual test plan needs.
 *
 *   node scripts/seed-test-users.mjs nils.weiler@gmail.com
 *   node scripts/seed-test-users.mjs nils.weiler@gmail.com http://localhost:3001
 *
 * Registers five accounts through the public API — the same path a real user
 * takes, so anything broken in registration shows up here rather than being
 * bypassed by writing to the database directly.
 *
 * Addresses use the +alias trick, so every account has a genuinely deliverable
 * inbox that all lands in yours. That matters: the plan checks that welcome and
 * receipt mails actually arrive, which a fake address cannot test.
 *
 * Safe to re-run. An account that already exists is reported and skipped.
 */

const baseEmail = process.argv[2];
const apiUrl = (process.argv[3] || 'https://api.shlep.ch').replace(/\/$/, '');

if (!baseEmail || !baseEmail.includes('@')) {
  console.error('Usage: node scripts/seed-test-users.mjs <your@email> [apiUrl]');
  console.error('Example: node scripts/seed-test-users.mjs nils.weiler@gmail.com');
  process.exit(1);
}

// One password for all test accounts — these are throwaway accounts on a test
// dataset, and a memorable password is worth more here than a strong one.
// Never reuse it for anything real.
const PASSWORD = 'ShlepTest2026!';

const [local, domain] = baseEmail.split('@');
const alias = (tag) => `${local}+shlep-${tag}@${domain}`;

const USERS = [
  {
    tag: 'sender',
    firstName: 'Sara',
    lastName: 'Sender',
    role: 'sender',
    note: 'Nur senden — Fahrer-Tabs müssen fehlen',
  },
  {
    tag: 'driver',
    firstName: 'Dario',
    lastName: 'Driver',
    role: 'driver',
    licensePlate: 'ZH 123456',
    carModel: 'VW Passat Variant',
    maxLoadKg: 580,
    vehicleSize: 'L',
    note: 'Fahrzeug gesetzt — kann Routen veröffentlichen',
  },
  {
    tag: 'both',
    firstName: 'Bea',
    lastName: 'Both',
    role: 'both',
    licensePlate: 'BE 654321',
    carModel: 'Toyota Yaris',
    maxLoadKg: 320,
    vehicleSize: 'S',
    note: 'Standardrolle. Kleines Fahrzeug — prüft die Kapazitätsfilterung',
  },
  {
    tag: 'recipient',
    firstName: 'Rico',
    lastName: 'Recipient',
    role: 'recipient',
    note: 'Startet auf Eingang, muss trotzdem senden können',
  },
  {
    tag: 'third',
    firstName: 'Tom',
    lastName: 'Third',
    role: 'both',
    note: 'Unbeteiligter — für die Zugriffstests in Block I',
  },
];

const results = [];

for (const u of USERS) {
  const email = alias(u.tag);
  const { tag, note, ...payload } = u;
  try {
    const res = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, email, password: PASSWORD, language: 'de' }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok && body?.success !== false) {
      results.push({ tag, email, status: 'angelegt', note });
    } else {
      const msg = body?.error || `HTTP ${res.status}`;
      const exists = /exist|registriert|taken|unique/i.test(String(msg));
      results.push({ tag, email, status: exists ? 'existiert bereits' : `FEHLER: ${msg}`, note });
    }
  } catch (err) {
    results.push({ tag, email, status: `FEHLER: ${err.message}`, note });
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nTestkonten auf ${apiUrl}`);
console.log(`Passwort für alle: ${PASSWORD}\n`);
console.log(pad('Rolle', 11) + pad('E-Mail', 42) + 'Status');
console.log('─'.repeat(84));
for (const r of results) {
  console.log(pad(r.tag, 11) + pad(r.email, 42) + r.status);
}
console.log('─'.repeat(84));
for (const r of results) console.log(`${pad(r.tag, 11)}${r.note}`);

const failed = results.filter((r) => r.status.startsWith('FEHLER'));
if (failed.length) {
  console.log(`\n${failed.length} Konto/Konten konnten nicht angelegt werden.`);
  process.exit(1);
}
console.log('\nAlle Konten bereit. Weiter mit MANUAL_TEST_PLAN.md, Block A.\n');
