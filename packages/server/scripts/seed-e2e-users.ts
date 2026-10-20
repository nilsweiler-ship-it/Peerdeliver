/**
 * Create the three accounts the end-to-end suite drives.
 *
 *   E2E_PASSWORD='...' npx tsx scripts/seed-e2e-users.ts
 *
 * Run once. Thereafter the suite only logs in, so it needs no database access
 * at all — which matters, because the database is behind an IP allow list that
 * a CI runner will never be on.
 *
 * These accounts exist so the tests cannot be broken by, and cannot pollute,
 * the real ones. A test run creates deliveries, moves test money and leaves
 * earnings behind; none of that belongs in the history of an account used to
 * demonstrate the product.
 *
 *
 * WHY THEY ARE SEEDED RATHER THAN REGISTERED
 *
 * Registration requires a phone verification code by SMS, which no automated
 * run can receive. The server deliberately refuses to let a client mark its
 * own number verified once Twilio is configured — that refusal is correct and
 * should stay. So verification is set here instead, directly, by someone with
 * database access.
 *
 * The driver is given an XL vehicle: getNearbyDeliveries filters on the
 * driver's PROFILE vehicle size, so an L driver silently never sees an XL
 * parcel. A test that cannot see what it just created fails for a reason that
 * has nothing to do with what it is testing.
 *
 * What this cannot do: Stripe Connect onboarding. That is a hosted form and
 * someone has to fill it in once, as the e2e driver, before payouts work.
 * The script says so at the end rather than leaving it to be discovered.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config';

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export const E2E_USERS = [
  {
    email: 'e2e-sender@shlep.ch',
    firstName: 'E2E',
    lastName: 'Sender',
    role: 'sender' as const,
    phone: '+41790000001',
  },
  {
    email: 'e2e-driver@shlep.ch',
    firstName: 'E2E',
    lastName: 'Driver',
    role: 'driver' as const,
    phone: '+41790000002',
    vehicleSize: 'XL' as const,
    maxLoadKg: 800,
    licensePlate: 'ZH 100001',
    carModel: 'Test Van',
  },
  {
    email: 'e2e-recipient@shlep.ch',
    firstName: 'E2E',
    lastName: 'Recipient',
    role: 'recipient' as const,
    phone: '+41790000003',
  },
];

async function main() {
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 10) {
    console.error(r('\n  E2E_PASSWORD must be set and at least 10 characters.\n'));
    console.error(
      dim(
        '  Generate one and keep it with the other secrets:\n\n' +
          "      E2E_PASSWORD=\"$(openssl rand -base64 24)\" npx tsx scripts/seed-e2e-users.ts\n\n" +
          '  The same value goes in packages/server/.env and in the repository\n' +
          '  secrets, so local runs and CI drive the same accounts.\n',
      ),
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  console.log(bold('\nSeeding end-to-end accounts'));
  console.log(dim('─'.repeat(70)));

  for (const u of E2E_USERS) {
    const data = {
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      phone: u.phone,
      passwordHash,
      // Verified here because no automated run can receive an SMS, and the
      // server is right to refuse self-certification when Twilio is live.
      phoneVerified: true,
      idVerified: true,
      verificationStatus: 'verified' as const,
      ...(u.vehicleSize ? { vehicleSize: u.vehicleSize } : {}),
      ...(u.maxLoadKg ? { maxLoadKg: u.maxLoadKg } : {}),
      ...(u.licensePlate ? { licensePlate: u.licensePlate, plateVerified: true } : {}),
      ...(u.carModel ? { carModel: u.carModel } : {}),
    };

    const user = await prisma.user.upsert({
      where: { email: u.email },
      // Password is reset on every run on purpose: the point of these accounts
      // is that the suite can always log in, and a forgotten password is
      // exactly how the manual accounts became unusable.
      update: data,
      create: { email: u.email, ...data },
      select: { id: true, email: true, role: true, stripeAccountId: true, stripePayoutsEnabled: true },
    });

    console.log(`  ${g('✓')} ${user.email.padEnd(26)} ${dim(user.role)} ${dim(user.id)}`);
    if (u.role === 'driver') {
      console.log(
        user.stripePayoutsEnabled
          ? dim(`      payouts enabled · ${user.stripeAccountId}`)
          : y('      payouts NOT enabled — see below'),
      );
    }
  }

  const driver = await prisma.user.findUnique({
    where: { email: 'e2e-driver@shlep.ch' },
    select: { stripePayoutsEnabled: true },
  });

  console.log(dim('\n' + '─'.repeat(70)));
  if (!driver?.stripePayoutsEnabled) {
    console.log(
      y('\n  One manual step remains, once.\n') +
        dim(
          '\n  Stripe Connect onboarding is a hosted form and cannot be scripted.\n' +
            '  Log into the app as e2e-driver@shlep.ch, open payout setup, and\n' +
            "  complete it with Stripe's test values:\n\n" +
            '      IBAN     CH9300762011623852957\n' +
            '      address  line 1 "address_full_match", Winterthur, 8400\n' +
            '      DOB      01 / 01 / 1901\n\n' +
            '  Until that is done the suite will reach the payout step and stop\n' +
            '  there — correctly, because an unonboarded driver cannot be paid.\n',
        ),
    );
  } else {
    console.log(g('\n  All three accounts ready, driver onboarded for payouts.\n'));
  }
}

main()
  .catch((e) => {
    console.error(r(`\n  ${String(e?.message ?? e)}\n`));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
