# Shlep — marketing site (shlep.ch)

A static, self-contained site to publish at **shlep.ch** — enough to satisfy the TWINT / Stripe application's "website URL" requirement, and to open a waitlist. On-brand (spruce + paper + route-line motif, Bricolage / Hanken / JetBrains Mono) and multilingual **DE (default) · FR · IT · EN**.

## Files
- `index.html` — landing page (hero, live handoff demo, how it works, sender/driver tabs, pricing slider, trust, CO₂ impact, waitlist, FAQ, footer). Design: amber `#E0A32E` accent + forest green `#14532D`, "S-Route" logo mark (concept E), IBM Plex Sans/Mono + Bricolage Grotesque.
- `assets/` — hero & sender photos (webp).
- `legal.html` — Terms, Privacy Policy, and Impressum (tabbed), reached from the footer.
- `kontakt.html` — contact page (topic + message form via the same formsubmit relay, direct email aside).
- `partner.html` — marketplace partner page: tiered integration options, live widget demo, quote-endpoint docs.
- `shlep-widget.js` — embeddable checkout widget partners drop into their site (calls `POST /api/partner/quote`).
- `i18n.js` — landing translations + language switcher (remembers choice, auto-detects browser language).
- `legal.js` — legal document text in all four languages.

No build step, no dependencies (fonts load from Google Fonts). Just static files.

## Preview locally
Open `index.html` in a browser, or serve the folder:
```bash
cd website && python3 -m http.server 8080   # then visit http://localhost:8080
```

## Deploy (free options)
Any static host works. Fastest:
- **Cloudflare Pages / Netlify / Vercel** — drag-and-drop this `website/` folder, or connect the repo. Then add the custom domain `shlep.ch`.
- **GitHub Pages** — push the folder to a repo and enable Pages.

**DNS note:** shlep.ch's nameservers point at Netlify (`dns1-4.p04.nsone.net`), so ALL DNS records (MX, SPF/DKIM, api subdomain) must be edited in Netlify → Domains → shlep.ch → DNS. The Hostpoint DNS zone is inactive and ignored.

## Waitlist backend
The signup form POSTs to `formsubmit.co/ajax/hello@shlep.ch` (free relay, no account). **Activated 2026-07-25** — signups, Kontakt messages and `/new` delivery requests all arrive at hello@shlep.ch (forwarded to Gmail).

⚠️ **Deliverability:** formsubmit sends from its own domain, so Gmail tends to file the notifications as spam. Whitelist `formsubmit.co` in Gmail. Longer term, move the forms server-side (own endpoint + Resend) — see TASKS.md.

The forms check the relay's response and only show the success state if it actually accepted the submission; otherwise they surface an error plus a direct mailto link.

## Before submitting to TWINT / Stripe — fill these in
The legal pages contain `[bracketed]` placeholders that MUST be completed with your real details:
- **Impressum:** legal entity name + form, address, UID (CHE-…), authorised signatory, contact email/phone.
- **Privacy:** data controller entity + address, and a real `privacy@shlep.ch` (or similar) inbox.
- **Terms:** confirm place of jurisdiction.

Also set a real destination for the waitlist form (currently `mailto:hello@shlep.ch`) — e.g. a form service (Tally, Formspree) or your own endpoint.

> The legal text is a template, not legal advice — have a Swiss lawyer review it before launch.
