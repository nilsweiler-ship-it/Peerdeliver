# Test the email setup

From `packages/server` with the real `.env` in place:

```bash
npx tsx -e "
import { sendWelcome } from './src/services/email';
sendWelcome({ to: 'nils.weiler@gmail.com', firstName: 'Nils', language: 'de' });
setTimeout(() => process.exit(0), 3000);
"
```

Expect `[email:sent] …` in the console and the mail in your **inbox** (not spam),
sent from `hello@shlep.ch`. If it says `[email:skipped]`, RESEND_API_KEY isn't loaded.
