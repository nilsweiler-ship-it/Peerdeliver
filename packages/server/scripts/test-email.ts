/**
 * One-off check that Resend is wired up correctly.
 *
 *   cd /Users/weilernils/Peerdeliver/packages/server
 *   npx tsx scripts/test-email.ts you@example.com
 *
 * Expects RESEND_API_KEY + EMAIL_FROM in packages/server/.env
 */
import 'dotenv/config';
import * as emailService from '../src/services/email';

const to = process.argv[2] || 'nils.weiler@gmail.com';

if (!emailService.isConfigured()) {
  console.error('RESEND_API_KEY is not set — check packages/server/.env');
  process.exit(1);
}

console.log(`from : ${process.env.EMAIL_FROM || 'Shlep <hello@shlep.ch>'}`);
console.log(`to   : ${to}\n`);

emailService.sendWelcome({ to, firstName: 'Nils', language: 'de' });

// give the fire-and-forget send time to finish before the process exits
setTimeout(() => {
  console.log('\nDone. Check your inbox (and, if empty, the spam folder).');
  process.exit(0);
}, 4000);
