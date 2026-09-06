# Stripe Connect — Aktivierung

Der Code ist vollständig verdrahtet und liegt hinter `stripeConfigured()`, das
nur `STRIPE_SECRET_KEY` prüft. Sobald der Schlüssel in Render steht, schaltet
der Server von simuliert auf echt um — ohne Codeänderung, ohne neuen Build.

Diese Datei beschreibt, was einzurichten ist, und **eine Architekturfrage, die
vor dem Livegang entschieden werden muss.**

---

## 0. Die Entscheidung zuerst: TWINT kann keinen Zahlungsvorbehalt

Nachgeprüft am 7. August 2026: **TWINT unterstützt bei Stripe kein
`capture_method: manual`.** Eine TWINT-Zahlung wird eingezogen, sobald die
sendende Person sie in der TWINT-App bestätigt. Es gibt keine Autorisierung,
die man später einzieht oder verfallen lässt.

Daraus folgt eine Wahl, die man nicht umgehen kann:

| | Geld fliesst | Schutz der sendenden Person | Wer hält das Geld bis zur Zustellung |
| --- | --- | --- | --- |
| **A — heutiger Code**<br>separate charges + transfers | Einzug sofort auf das Plattform-Guthaben, Transfer an die fahrende Person nach dem Zustellcode | **Voll.** Ohne Code kein Transfer. | **Shlep** (im Stripe-Guthaben) |
| **B — destination charge**<br>`transfer_data[destination]` | Aufteilung im Moment der Zahlung, Anteil geht direkt an die fahrende Person | **Keiner.** Bezahlt vor der Zustellung. | niemand |
| **C — Karte mit Vorbehalt**<br>`capture_method: manual` | Reservierung auf der Karte, Einzug erst bei Zustellung | Voll | niemand — die Reservierung liegt auf der Karte |

**Der Konflikt:** Variante A ist genau das, was auf shlep.ch steht („Der Betrag
wird reserviert und erst nach der per Code bestätigten Zustellung
freigegeben"). Sie bedeutet aber, dass Shlep zwischen Einzug und Transfer
fremde Gelder hält — und die Hilfsperson-Ausnahme nach Art. 2 Abs. 2 lit. a
Ziff. 2 GwV setzt voraus, dass man **keine Verfügungsmacht über Kundengelder**
hat. Variante B löst das GwG-Thema und zerstört den Schutz. Variante C löst
beides, funktioniert aber nur mit Karte, nicht mit TWINT — und TWINT ist in der
Schweiz die Zahlungsart, die zählt.

**Empfehlung für den Piloten:** Variante A fahren. Nicht, weil sie sauber ist,
sondern weil die Berufsmässigkeitsschwellen der GwV (CHF 50'000 Bruttoerlös,
20 nicht-einmalige Geschäftsbeziehungen, CHF 2 Mio. Transaktionsvolumen) in
einem Pilot nicht erreicht werden. Die Schwelle von 20 Beziehungen ist die
engste — das sind zwanzig wiederkehrende Fahrer:innen. **Vor dem Überschreiten
muss ein Anwalt den Geldfluss beurteilt haben**, und ab dem Überschreiten läuft
eine Frist von zwei Monaten für ein SRO-Gesuch.

Eine spätere Option, falls A zu eng wird: Karte mit Vorbehalt (C) als
Standard, TWINT als Sofortzahlung ohne Rückhalt — mit ehrlicher Kennzeichnung
im Checkout, welche der beiden gewählt wurde.

---

## 1. Umgebungsvariablen in Render

Genau diese drei liest der Code (`packages/server/src/config/env.ts`). Alle
drei sind in `render.yaml` bereits als `sync: false` deklariert, müssen also im
Dashboard von Hand gesetzt werden.

| Variable | Woher | Bemerkung |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Developers → API keys → Secret key | **Dieser Schlüssel allein schaltet den Echtbetrieb ein.** Erst `sk_test_…` verwenden. |
| `STRIPE_PUBLISHABLE_KEY` | dieselbe Seite | Für die App |
| `STRIPE_WEBHOOK_SECRET` | beim Anlegen des Endpoints (unten) | Ohne ihn antwortet der Webhook mit 503 |

`STRIPE_PLATFORM_COUNTRY` hat den Default `CH` und muss nicht gesetzt werden.

> **Wichtig:** Solange `STRIPE_SECRET_KEY` fehlt, ist jede Auszahlung simuliert
> und `driverCanReceivePayouts()` gibt für alle `true` zurück. Setzt man den
> Schlüssel, greift ab sofort die Onboarding-Prüfung — Fahrer:innen ohne
> abgeschlossenes Stripe-Onboarding können keine Lieferung mehr annehmen.
> Das ist gewollt, aber es ändert das Verhalten für bestehende Testkonten.

---

## 2. Webhook-Endpoint

**URL:** `https://api.shlep.ch/webhooks/stripe`
(nicht unter `/api` — der Endpoint ist vor `express.json()` montiert, weil die
Signaturprüfung den Rohtext braucht.)

Genau diese vier Events verarbeitet `handleStripeEvent`. Mehr zu abonnieren
schadet nicht, weniger bricht den Ablauf:

| Event | Wirkung |
| --- | --- |
| `payment_intent.succeeded` | `paymentStatus` → `authorised` |
| `payment_intent.payment_failed` | `paymentStatus` → `failed` |
| `charge.refunded` | `paymentStatus` → `refunded`, Betrag und Zeitpunkt |
| `account.updated` | Onboarding- und Auszahlungsstatus der fahrenden Person |

`account.updated` betrifft **verbundene Konten**. Beim Anlegen des Endpoints in
Stripe zusätzlich „Listen to events on Connected accounts" aktivieren, sonst
bleibt der Auszahlungsstatus der Fahrer:innen für immer auf `false`.

---

## 3. Connect im Dashboard

- Connect aktivieren, Plattformprofil ausfüllen
- **Kontotyp: Express** — der Code erstellt `type: 'express'`, Land `CH`,
  `capabilities: { transfers: { requested: true } }`
- Business-Beschreibung: *Vermittlungsplattform, die sendende Personen mit
  privaten Fahrer:innen zusammenbringt.* Nicht als Spedition, Frachtführer
  oder Geldtransfer beschreiben — das löst eine manuelle Prüfung aus oder
  fällt in eine eingeschränkte Kategorie.
- TWINT unter Payment methods aktivieren
- Auszahlungsintervall der Plattform festlegen (Default täglich)

---

## 4. Testlauf, bevor ein echter Schlüssel gesetzt wird

```bash
export STRIPE_SECRET_KEY=sk_test_…
node scripts/stripe-e2e.mjs
```

Das Skript legt ein verbundenes Testkonto an, erzeugt eine Zahlung über CHF 69,
bestätigt sie mit einer Testkarte, rechnet die Aufteilung nach denselben Regeln
wie der Server und führt den Transfer aus. Am Ende steht, was bei der fahrenden
Person ankommt und was bei der Plattform bleibt.

Es schreibt **nichts** in die Datenbank und ruft keinen Shlep-Endpoint auf —
es prüft ausschliesslich, ob der Stripe-Teil funktioniert.

---

## 5. Reihenfolge beim Livegang

1. Testschlüssel in Render, `scripts/stripe-e2e.mjs` grün
2. Webhook mit Testschlüssel anlegen, eine Testzahlung durchklicken, im
   Render-Log den Eingang prüfen
3. Eine echte Lieferung mit zwei Testkonten von Anfang bis Ende
4. Erst dann Live-Schlüssel — und daran denken: **eigene Webhook-Secrets pro
   Modus.** Test- und Live-Endpoint haben unterschiedliche Secrets.
5. Nach dem Umschalten: eine Fahrerin durch das Express-Onboarding schicken und
   prüfen, dass `stripePayoutsEnabled` in der Datenbank auf `true` geht

---

## 6. Was danach noch simuliert bleibt

- **Identitätsprüfung** (`verify` mit `type: 'id'`) setzt weiterhin einfach
  `idVerified = true`. Stripe Identity wäre der nächste Schritt.
- **Kennzeichenprüfung** ist eine Formatprüfung gegen die Kantonskürzel, keine
  Abfrage beim Strassenverkehrsamt.

Beides ist im Code als solches markiert und sollte nicht als geprüft
kommuniziert werden.
