/**
 * One-off: send the delivery code to recipients of deliveries that are already
 * in flight.
 *
 *   cd packages/server
 *   npx tsx scripts/backfill-recipient-codes.ts --dry
 *   npx tsx scripts/backfill-recipient-codes.ts
 *
 * Why this is needed: until now nothing was ever addressed to the recipient.
 * The delivery code has always existed in the database — it is generated when
 * the delivery is created — so nothing is lost or needs regenerating. What was
 * missing was a channel to deliver it. Deliveries picked up before that channel
 * existed still have recipients who were never told their code.
 *
 * Only touches deliveries currently `picked_up` or `in_transit`. Anything
 * already delivered needs no code, and anything not yet collected will get the
 * email at pickup through the normal path.
 *
 * Idempotent in the sense that re-running only re-sends; it never changes data.
 * Run with --dry first.
 */
import 'dotenv/config';
import { prisma } from '../src/config';
import * as emailService from '../src/services/email';
import * as smsService from '../src/services/sms';

const dry = process.argv.includes('--dry');

async function main() {
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      recipientEmail: string | null;
      recipientPhone: string | null;
      deliveryCode: string | null;
      pickupLabel: string;
      deliveryLabel: string;
      status: string;
      senderFirstName: string | null;
      senderLanguage: string | null;
    }[]
  >(`
    SELECT dr.id, dr."recipientEmail", dr."recipientPhone", dr."deliveryCode",
           dr."pickupLabel", dr."deliveryLabel", dr.status,
           u."firstName" AS "senderFirstName", u.language AS "senderLanguage"
      FROM delivery_requests dr
      JOIN users u ON u.id = dr."senderId"
     WHERE dr.status IN ('picked_up', 'in_transit')
       AND dr."deliveryCode" IS NOT NULL
       AND (dr."recipientEmail" IS NOT NULL OR dr."recipientPhone" IS NOT NULL)
     ORDER BY dr."createdAt"
  `);

  if (!rows.length) {
    console.log('Keine offenen Lieferungen — nichts zu tun.');
    return;
  }

  console.log(`${rows.length} Lieferung(en) unterwegs${dry ? ' (Probelauf, es wird nichts gesendet)' : ''}:\n`);

  let mails = 0;
  let texts = 0;

  for (const r of rows) {
    const route = `${r.pickupLabel} → ${r.deliveryLabel}`;
    const targets = [r.recipientEmail && 'E-Mail', r.recipientPhone && 'SMS']
      .filter(Boolean)
      .join(' + ');
    console.log(`  ${r.id.slice(0, 8)}  ${r.status.padEnd(11)} ${targets.padEnd(14)} ${route}`);

    if (dry) continue;

    if (r.recipientEmail && r.deliveryCode) {
      emailService.sendRecipientPickedUp({
        to: r.recipientEmail,
        route,
        deliveryCode: r.deliveryCode,
        senderName: r.senderFirstName,
        language: r.senderLanguage,
      });
      mails++;
    }
    if (r.recipientPhone && r.deliveryCode) {
      smsService.notifyRecipientPickedUp(r.recipientPhone, route, r.deliveryCode);
      texts++;
    }
  }

  if (dry) {
    console.log('\nProbelauf beendet. Ohne --dry erneut ausführen, um zu senden.');
    return;
  }

  // Sends are fire-and-forget; give them a moment before the process exits.
  await new Promise((r) => setTimeout(r, 4000));
  console.log(`\nFertig: ${mails} E-Mail(s), ${texts} SMS.`);
}

main()
  .catch((err) => {
    console.error('Fehlgeschlagen:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
