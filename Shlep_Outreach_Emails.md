# Shlep — Outreach Email Drafts

Five ready-to-send drafts: two for investors (cold + warm follow-up), three for partners (marketplaces, SME senders, driver/community supply). Swap the bracketed fields, attach `Shlep_Investor_Deck.pptx`, and send. Keep them short — these are written to get a reply, not to explain everything.

---

## 1 · Investor — cold outreach

**Subject:** Shlep — the low-carbon parcel network for Switzerland (pre-seed)

Hi [First name],

I'm Nils, founder of **Shlep**. We turn trips people are already making into a delivery network: a sender posts a parcel, a neighbour or commuter already driving that way carries it, and every handoff is verified with a 6-digit code and tracked live.

The result is delivery that's cheaper than a courier, more personal, and genuinely low-carbon — because the trip already exists. Last-mile is up to ~28% of transport CO₂, and Swiss e-commerce (~CHF 15.8B, growing again) keeps adding vans to the road.

We're not pitching a slide-ware idea: the app and payments (Stripe Connect + TWINT, automatic driver payouts) are **built and pilot-ready**. We're raising a pre-seed round to launch our Zürich pilot.

Could I share a 5-minute overview or grab 20 minutes next week? Deck attached.

Best,
Nils Weiler
Founder, Shlep · nils.weiler@gmail.com

---

## 2 · Investor — warm intro follow-up

**Subject:** Following up — Shlep (intro from [Referrer])

Hi [First name],

Thanks to [Referrer] for the introduction. Quick context on **Shlep**: we're building Switzerland's peer-to-peer parcel network — parcels ride along trips people are already taking, verified end-to-end and tracked live.

Why now, briefly:

- **Working product.** iOS/Android app + backend + escrow payments are live, not mocked.
- **Real wedge.** Cheaper than couriers *and* low-carbon — the trip already exists, so there are no new vehicle-km.
- **Compounding supply.** Commuters publish recurring routes, so one driver serves many parcels.

We're raising [CHF 750k] pre-seed to run the Zürich pilot and hit the metrics for a seed round. I've attached the deck — would you be open to a call the week of [date]?

Best,
Nils

---

## 3 · Partner — SME retailers / local shops (demand side)

**Subject:** Greener same-region delivery for [Company], at courier-beating prices

Hi [First name],

I run **Shlep**, a Swiss peer-to-peer delivery network. For shops like [Company] shipping within the region, we offer a cheaper, low-carbon alternative to couriers: your parcels ride along trips locals are already making, with code-verified pickup/drop-off and live tracking — and a per-order CO₂ figure you can show your customers.

We're onboarding a small group of Zürich-area senders for our launch pilot. I'd love to set [Company] up with free credits for the first deliveries and get your feedback.

Open to a quick call this week?

Best,
Nils Weiler
Founder, Shlep · nils.weiler@gmail.com

---

## 4 · Partner — driver/community supply (e.g. commuter groups, associations)

**Subject:** Earn on the drive you already make — Shlep is launching in Zürich

Hi [First name],

Quick one: **Shlep** lets people earn money on trips they're already driving by carrying a neighbour's parcel along the way. Members of [Community/Group] who regularly commute [route, e.g. Zürich–Winterthur] are exactly who we're looking for as founding drivers.

It takes a minute to publish a recurring route, payouts are automatic (90% goes to the driver), and every delivery is code-verified and insured-feeling. It's flexible, local, and low-carbon by design.

Could we offer [Community/Group] early access and a small referral bonus for founding drivers? Happy to explain in 10 minutes.

Best,
Nils

---

## 5 · Partner — second-hand / classifieds marketplace (integration)

*Best-fit target: Ricardo, tutti, Anibis, Facebook-Marketplace-Alternativen, Möbel- und Velo-Plattformen. Auf Deutsch, weil die Produktteams dort deutsch arbeiten.*

**Subject:** Lieferoption für Sperrgut — ein Snippet, kein Backend

Hallo [Vorname],

bei [Marktplatz] scheitern viele Deals nicht am Preis, sondern an der Logistik: Der Sessel, der Fernseher, das Velo — zu sperrig für den Paketkanal, Originalkarton längst entsorgt, also bleibt „nur Selbstabholung". Damit fällt jede Käuferin ausserhalb der Region weg.

Genau da setzt **Shlep** an: verifizierte Nachbarn nehmen den Artikel auf einer Fahrt mit, die sie ohnehin machen. Versichert bis CHF 1'000, Übergabe per 6-stelligem Code bestätigt, live verfolgbar — und weil von Hand zu Hand geliefert wird, braucht es keine Verpackung.

Für euch ist die Integration bewusst klein gehalten:

```html
<div data-shlep data-key="…" data-from="47.3769,8.5417" data-to="47.5001,8.7501"></div>
<script src="https://shlep.ch/shlep-widget.js" async></script>
```

Ein Script-Tag im Checkout zeigt Live-Preis, Verfügbarkeit auf der Strecke und die eingesparte CO₂-Menge. **Kein Backend-Aufwand, keine Kosten für euch** — abgerechnet wird direkt zwischen Shlep und der sendenden Person, ihr tragt kein Inkasso-Risiko.

Live-Demo und Doku: **shlep.ch/partner.html**

Hättet ihr 20 Minuten, um zu schauen, ob das auf euren Sperrgut-Kategorien Sinn ergibt? Einen Test-Key schicke ich innert 24 Stunden.

Freundliche Grüsse
Nils Weiler
Gründer, Shlep · DeltaSci Solutions GmbH · hello@shlep.ch

---

*Note: the CHF 750k round size and allocation in the deck are indicative placeholders — set them to your actual plan before sending.*
