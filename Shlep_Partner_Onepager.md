# Shlep für Marktplätze — Integration in drei Stufen

*Partner-Onepager · Stand 25.07.2026 · DeltaSci Solutions GmbH, CHE-347.257.714*

---

## Das Angebot in einem Satz

Shlep ist das Schweizer Peer-to-Peer-Liefernetz: verifizierte Nachbarn nehmen ein Paket auf einer Fahrt mit, die sie ohnehin machen — **versichert bis CHF 1'000, per 6-stelligem Code bestätigt, CO₂-arm**. Für einen Marktplatz ist es eine zusätzliche Lieferoption, die genau dort greift, wo der klassische Paketkanal schwach ist.

## Warum gerade für Gebraucht- und Sperrgut

| Problem im Second-hand-Checkout | Was Shlep löst |
|---|---|
| Sessel, TV, Velo passen in keinen Paketkanal | Fährt im Auto mit — Grösse ist eine Frage der Fahrt, nicht des Tarifs |
| Originalkarton längst entsorgt | Übergabe von Hand zu Hand, keine Verpackungspflicht |
| „Nur Selbstabholung" killt Reichweite | Käufer:innen ausserhalb der Region werden erreichbar |
| Versand teuer im Verhältnis zum Artikelwert | Preis wird pro Fahrt gesetzt, nicht pro Tarifzone |
| Kein Vertrauen zwischen Fremden | Verifizierte Profile, Code-Bestätigung, Versicherung, beidseitige Bewertung |

**Zusätzlich:** jede Lieferung weist die eingesparte CO₂-Menge aus — verwendbar für eure Nachhaltigkeitskommunikation.

---

## Drei Integrationstiefen

### Stufe 1 — Deep-Link-Button · ≈ 15 Minuten, kein Key

Ein Link auf dem Inserat oder im Checkout, der Shlep mit vorausgefüllter Route öffnet:

```
https://shlep.ch/new?fromLat=…&fromLng=…&toLat=…&toLng=…&price=32&size=large&src=partner
```

Kein Vertrag, kein API-Key, reines HTML. Ideal für einen schnellen Test auf einer Kategorieseite.

### Stufe 2 — Checkout-Widget · ≈ 1 Stunde, publishable Key **(verfügbar)**

Ein Script-Tag rendert die Lieferoption inklusive **Live-Preis, Verfügbarkeit auf der Strecke und CO₂-Ersparnis** direkt im Checkout:

```html
<div data-shlep
     data-key="pk_live_deinkey"
     data-from="47.3769,8.5417"
     data-to="47.5001,8.7501"
     data-size="large"
     data-value="450"></div>
<script src="https://shlep.ch/shlep-widget.js" async></script>
```

Front-end only — **kein Backend-Aufwand auf eurer Seite**. Events `shlep:quote` und `shlep:select` für euer Tracking; `data-lang` für DE/EN; `Shlep.refresh()` für SPA-Checkouts.

**Ausfallsicher:** ist die Quote-API kurz nicht erreichbar, zeigt das Widget einen Preis-Schätzwert statt einer Fehlermeldung. Euer Checkout bricht nie wegen uns.

Live ansehen: **shlep.ch/partner.html**

### Stufe 3 — REST-API & Webhooks · auf Anfrage, Server-Key

Lieferungen programmatisch anlegen, Status-Webhooks (`matched`, `picked_up`, `delivered`) zurück in euer System. Für Partner, die Sendungen automatisiert oder in Bulk erzeugen wollen. Wir bauen das gemeinsam auf euren konkreten Flow — sinnvoll ab dem Punkt, an dem Stufe 2 Volumen zeigt.

---

## Der Quote-Endpoint (Stufe 2/3)

Read-only, CORS-offen, publishable Key. **Keine Nutzerdaten** — nur Koordinaten rein, Preis und Verfügbarkeit raus.

```http
POST https://api.shlep.ch/api/partner/quote
X-Shlep-Key: pk_live_deinkey

{ "fromLat": 47.3769, "fromLng": 8.5417,
  "toLat": 47.5001, "toLng": 8.7501,
  "size": "large", "declaredValueCHF": 450 }
```

```json
{ "success": true, "data": {
    "available": true,
    "priceCHF": 37, "priceRangeCHF": { "min": 30, "max": 48 },
    "distanceKm": 20.8,
    "driverPayoutCHF": 33.67, "platformFeeCHF": 3.33,
    "coverage": { "level": "medium", "matchingRoutes": 4, "estimatedMatchHours": 6 },
    "insuredUpToCHF": 1000, "co2SavedKg": 3.7,
    "deepLink": "https://shlep.ch/new?…" } }
```

`coverage.level` (`high`/`medium`/`low`/`none`) kommt aus den real publizierten Fahrer-Routen auf dieser Strecke — ihr zeigt also nie eine Option an, die niemand fahren kann.

---

## Kommerzielles

- **Für den Marktplatz kostenlos.** Keine Setup-Gebühr, keine Lizenz.
- **Abrechnung direkt zwischen Shlep und der sendenden Person** (TWINT oder Karte). Ihr leitet kein Geld weiter und tragt kein Inkasso-Risiko.
- Shlep behält 9 % (mind. CHF 1.50) und deckt damit Versicherung, Zahlungsabwicklung und Support; 91 % gehen an die fahrende Person.
- **Revenue-Share für Volumenpartner** ist verhandelbar — sprecht uns an.

## Was wir von euch brauchen

1. Typische Strecken und Artikelkategorien (damit wir Fahrer-Angebot gezielt aufbauen).
2. Eine Testseite oder Staging-Checkout für die Integration.
3. Eine Ansprechperson auf Produktseite — mehr nicht.

## Nächster Schritt

Test-Key innert 24 Stunden: **hello@shlep.ch** · shlep.ch/partner.html

---

*Preis- und CO₂-Werte sind Schätzungen für die Anzeige im Checkout; der finale Preis wird von der sendenden Person in Shlep bestätigt.*
