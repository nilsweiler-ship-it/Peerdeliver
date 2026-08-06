# Shlep — Manueller Testplan

*Alles, was sich nur auf echten Geräten mit echten Konten prüfen lässt.*

Automatisiert geprüft sind: Typen, Konfiguration, i18n-Vollständigkeit, Build (`npm run preflight` und `npm run verify`). Dieser Plan deckt den Rest ab — alles, was echte Hardware, echte Zustellung oder zwei Personen braucht.

**Reihenfolge einhalten.** Block A erzeugt die Konten, die alle weiteren Blöcke benutzen.

---

## Vorbereitung

**Zwei Geräte.** Ein iPhone mit dem aktuellen Build, ein zweites Gerät (Telefon oder Simulator) für die fahrende Person. Zwei Konten auf einem Gerät gleichzeitig geht nicht.

### Testkonten anlegen

Einmalig, legt alle fünf Konten über die öffentliche API an:

```bash
cd "$HOME/Peerdeliver"
npm run seed:testusers -- nils.weiler@gmail.com
```

Gegen die lokale Umgebung stattdessen:

```bash
npm run seed:testusers -- nils.weiler@gmail.com http://localhost:3001
```

**Passwort für alle Konten:** `ShlepTest2026!`

| Rolle | E-Mail | Wofür |
|---|---|---|
| **sender** | `…+shlep-sender@gmail.com` | Nur senden — Fahrer-Tabs müssen fehlen |
| **driver** | `…+shlep-driver@gmail.com` | Fahrzeug ZH 123456, VW Passat, 580 kg, Grösse **L** |
| **both** | `…+shlep-both@gmail.com` | Standardrolle. Toyota Yaris, 320 kg, Grösse **S** — prüft Kapazitätsfilter |
| **recipient** | `…+shlep-recipient@gmail.com` | Startet auf Eingang, muss trotzdem senden können |
| **third** | `…+shlep-third@gmail.com` | Unbeteiligter — für die Zugriffstests in Block I |

Das Skript ist mehrfach ausführbar; bestehende Konten werden übersprungen.

**Für A1 wird bewusst kein Seed-Konto benutzt** — dieser Test prüft die Registrierung selbst. Dafür eine frische Adresse nehmen, z. B. `…+shlep-a1@gmail.com`. Eine Adresse lässt sich nur einmal registrieren; bei einem zweiten Durchlauf `…+shlep-a2@gmail.com` verwenden.

**Warum echte Adressen mit `+alias`:** alle landen in deinem Postfach, sind aber für Shlep verschiedene Konten — und der Plan prüft, ob Willkommens- und Belegmails tatsächlich ankommen. Mit erfundenen Adressen liesse sich das nicht testen.

⚠️ **Diese Zugangsdaten sind für Tests.** Vor dem öffentlichen Start löschen oder das Passwort ändern — sie stehen im Repo und wären sonst fünf bekannte Konten in der Produktivdatenbank.

**Fahrzeuggrössen sind bewusst verschieden:** `driver` fährt L, `both` fährt S. Damit lässt sich in D2 direkt prüfen, dass ein kleines Fahrzeug keine grossen Lieferungen angeboten bekommt.

**Eine Mobilnummer**, die bei Twilio unter *Verified Caller IDs* steht (nötig, solange das Konto im Trial ist).

**Offen halten während des Tests:**
- Render → `shlep-api` → **Logs** (dort steht, was wirklich passiert)
- Dein Postfach
- Twilio Console → Monitor → **Messaging Logs**
- Payrexx Admin → Transaktionen

**Bewertung:** ✅ funktioniert · ⚠️ funktioniert, aber unschön · ❌ kaputt. Bei ⚠️ und ❌ bitte notieren, was du gesehen hast und was du erwartet hättest.

---

## A · Konto & Verifizierung

| # | Test | Erwartet | |
|---|---|---|---|
| A1 | **Registrierung von Hand** — nicht mit einem Seed-Konto, denn hier wird der Registrierungsvorgang selbst geprüft.<br>Frische Adresse verwenden, z. B. `…+shlep-a1@gmail.com`, Passwort `ShlepTest2026!`, Rolle **unverändert**, Fahrzeugfelder **leer lassen** | Konto wird erstellt. Fahrzeugangaben sind **nicht** Pflicht. | ☐ |
| A2 | Willkommensmail prüfen | Kommt an, **im Posteingang, nicht im Spam**, Absender `hello@shlep.ch`, deutsche Anrede, Shlep-Design | ☐ |
| A3 | Profil → Verifizierung → Telefon → Nummer eingeben → *Code senden* | SMS kommt innert ~30 s an | ☐ |
| A4 | Code eingeben → *Verifizieren* | Häkchen erscheint, Trust-Score steigt | ☐ |
| A5 | Nochmal probieren mit **falschem** Code | Verständliche Fehlermeldung, kein Absturz, kein fälschliches Häkchen | ☐ |
| A6 | Code eingeben, 15 Min warten, dann absenden | Meldung „Code abgelaufen" (nicht „falsch") | ☐ |
| A7 | Prüfen, ob der Button *„Verify everything (dev)"* sichtbar ist | **Darf im Release-Build nicht erscheinen** | ☐ |
| A8 | Mit **driver** einloggen | Fahrzeugdaten sind vorhanden | ☐ |
| A9 | Als **driver** eine Route veröffentlichen | Klappt | ☐ |
| A10 | Als **sender** (kein Fahrzeug) → Route veröffentlichen | Verständliche Meldung „Bitte ergänze zuerst dein Fahrzeug", **kein** Absturz | ☐ |

> **A2 ist wichtiger als es aussieht.** Landet die Mail im Spam, stimmt etwas mit DKIM/SPF nicht — und dann sieht kein einziger echter Nutzer je eine Shlep-Mail.

---

## B · Lieferung erstellen

| # | Test | Erwartet | |
|---|---|---|---|
| B1 | Neue Lieferung → Marktplatz-Text einfügen: `Waschmaschine Miele, guter Zustand` | Grösse **L**, Gewicht ~35 kg | ☐ |
| B2 | Dasselbe mit `iPhone 14 Pro` | Grösse **S** | ☐ |
| B3 | Mit `Sofa 220 x 90 cm` | Grösse **L** (aus den Massen) | ☐ |
| B4 | Mit `Espressomaschine Jura, 9 kg` | Grösse **M**, Gewicht **9 kg** (aus dem Text) | ☐ |
| B5 | Mit Kauderwelsch, z. B. `asdf` | Fällt auf M / 3 kg zurück, ohne Fehler | ☐ |
| B6 | Adresssuche: **Dorf** eingeben (nicht Stadt), z. B. `Fehraltorf` | Erscheint in den Vorschlägen | ☐ |
| B7 | Adresssuche: **Strasse mit Hausnummer**, z. B. `Jonas-Furrer-Strasse 104` | Erscheint | ☐ |
| B8 | Flugmodus an → Adresse tippen | Keine Vorschläge, **kein Absturz**, App bleibt bedienbar | ☐ |
| B9 | Verpackung: alle vier Optionen antippen | Auswahl sichtbar, „Keine" ist Standard | ☐ |
| B10 | Empfänger-E-Mail **leer lassen** → Weiter | Wird abgelehnt, klare Meldung „E-Mail der empfangenden Person ist erforderlich" | ☐ |
| B11 | Ungültige E-Mail eingeben (`abc@`) → Weiter | Wird abgelehnt mit eigener Meldung | ☐ |
| B11b | Gültige E-Mail eingeben, Feld verlassen, wieder antippen und **ändern** | Text lässt sich normal bearbeiten, keine Autokorrektur, keine Grossschreibung | ☐ |
| B11c | Telefonnummer **leer lassen** | Wird akzeptiert — Telefon ist optional | ☐ |
| B12 | Feld „max. Gewicht" antippen → Zahlen-Tastatur öffnet sich → **nach unten wischen** | Tastatur schliesst sich, Formular bis zum Absenden-Button scrollbar | ☐ |
| B13 | Preis-Regler bewegen | Preis und Fahrer-Anteil aktualisieren sich (9 %, min. CHF 1.50) | ☐ |

> **B12 ist der Bug, der dich zwei Tage gekostet hat.** Die iOS-Zahlentastatur hat kein „Fertig". Bitte bei **jedem** Zahlenfeld prüfen, nicht nur diesem.

---

## C · Zahlung (TWINT via Payrexx)

| # | Test | Erwartet | |
|---|---|---|---|
| C1 | Lieferung abschliessen → Zahlung | **Echte** Payrexx-TWINT-Seite öffnet sich (nicht der simulierte Bildschirm) | ☐ |
| C2 | Payrexx Admin → Transaktionen | Transaktion sichtbar, Betrag stimmt, Referenz = Lieferungs-ID | ☐ |
| C3 | Render-Logs während der Zahlung | `[payrexx:webhook]` erscheint | ☐ |
| C4 | In der App: Status der Lieferung | Wechselt auf bezahlt/autorisiert | ☐ |
| C5 | Zahlung **abbrechen** statt bestätigen | Lieferung bleibt unbezahlt, kein Absturz, erneuter Versuch möglich | ☐ |
| C6 | Betrag in Payrexx vs. App | Identisch, auf den Rappen | ☐ |

> **C6:** Der Webhook lehnt eine Zahlung ab, deren Betrag nicht zum Auftrag passt. Weicht etwas ab, steht der Grund im Log.

---

## D · Fahrer findet und übernimmt

| # | Test | Erwartet | |
|---|---|---|---|
| D1 | Als **driver**: Lieferungen in der Nähe | Die eben erstellte Lieferung erscheint | ☐ |
| D2 | Fahrzeuggrösse in **driver** auf **S** stellen, Liste neu laden | Eine **L**-Lieferung erscheint **nicht** mehr | ☐ |
| D3 | Zurück auf L stellen → Lieferung annehmen | Klappt | ☐ |
| D4 | Als **sender**: Fahrer bestätigen | Status wechselt, Abholcode wird angezeigt | ☐ |
| D5 | Fahrersuche: Von/Nach als **Adressen** eingeben | Autovervollständigung funktioniert (nicht nur 12 Städte) | ☐ |

---

## E · Übergabe & Codes

| # | Test | Erwartet | |
|---|---|---|---|
| E1 | Als **driver** den **Abholcode** eingeben | Übergabe bestätigt | ☐ |
| E2 | Vorher **falschen** Code eingeben | Abgelehnt, verständliche Meldung | ☐ |
| E3 | Als **driver** den **Zustellcode** eingeben | Zustellung bestätigt | ☐ |
| E4 | Nach Zustellung: CO₂-Wert in der App | Wird angezeigt, **Text nicht abgeschnitten** (z. B. „2.5 kg") | ☐ |
| E5 | CO₂ bei Verpackung „Keine" vs. „Neuer Karton" vergleichen (zwei Lieferungen) | „Keine" ergibt einen höheren Wert | ☐ |

---

## F · Live-Tracking

**Nur auf echten Geräten, im Auto oder zu Fuss.** Der Simulator kann das nicht.

> **Zwei Dinge vorab, sonst wirkt Tracking kaputt, obwohl es funktioniert:**
>
> 1. **Es braucht ein zweites Gerät**, das als fahrende Person eingeloggt ist, die Lieferung angenommen hat und sich bewegt. Die frühere Attrappe — ein simulierter Punkt, der von A nach B glitt — ist in der Produktion bewusst abgeschaltet. Ohne echte fahrende Person bleibt die Karte leer, und das ist korrekt.
> 2. **Ausserhalb der Schweiz** wurde bisher nur eine leere Fläche gezeigt: die Swisstopo-Kacheln decken nur die Schweiz ab. Seit dem Fix wird ausserhalb auf OpenStreetMap umgeschaltet.
>
> In der Karte des Senders steht „Warte auf Standort", solange nichts eintrifft — das ist die ehrliche Anzeige, nicht ein Fehler.

| # | Test | Erwartet | |
|---|---|---|---|
| F1 | Während der Fahrt: Karte beim Sender | Fahrer-Punkt bewegt sich | ☐ |
| F2 | **Telefon des Fahrers sperren, 200 m bewegen** | Karte des Senders aktualisiert sich weiter | ☐ |
| F3 | App des Fahrers in den Hintergrund, 200 m bewegen | Aktualisiert sich weiter | ☐ |
| F4 | Nach Zustellung 10 Min warten | Tracking hat gestoppt, kein Standort mehr | ☐ |
| F5 | Standortberechtigung ablehnen → Lieferung annehmen | App funktioniert weiter, nur ohne Tracking, **kein Absturz** | ☐ |
| F6 | Sender lädt die App neu, während die Fahrt läuft | Letzte bekannte Position erscheint sofort wieder | ☐ |

> **F2 ist der eigentliche Test.** Vorher lief das Tracking auf einem Timer im Bildschirm und starb, sobald das Telefon gesperrt wurde — also genau dann, wenn losgefahren wird.

> **F4:** Läuft danach noch Standortverfolgung, ist das ein Datenschutzproblem und ein Grund für App-Store-Ablehnung.

---

## G · Benachrichtigungen

| # | Test | Erwartet | |
|---|---|---|---|
| G1 | Nach dem ersten Login: Push-Berechtigung | Wird abgefragt, **nicht** schon vor der Registrierung | ☐ |
| G2 | Fahrer nimmt an | Sender bekommt Push **und** Mail | ☐ |
| G3 | Abholung bestätigt | Sender bekommt Push mit Zustellcode-Hinweis | ☐ |
| G4 | Zustellung bestätigt | Sender: Push + Beleg-Mail; Fahrer: Auszahlungs-Mail | ☐ |
| G5 | Push antippen | App öffnet sich (Ziel-Screen ist noch nicht verdrahtet — nur notieren) | ☐ |
| G6 | Alle Mails: Design, Sprache, Absender | Shlep-Design, Sprache des Kontos, `hello@shlep.ch` | ☐ |
| G7 | Push bei **gesperrtem** Bildschirm | Kommt an | ☐ |

---

## H · Empfänger ohne Konto

Der Fall, der bei Marktplatz-Käufen am häufigsten ist.

| # | Test | Erwartet | |
|---|---|---|---|
| H1 | Lieferung mit **Telefonnummer** als Empfänger anlegen (nicht E-Mail) | Wird angenommen | ☐ |
| H2 | Fahrer bestätigt die Abholung | Diese Nummer erhält eine SMS von **„Shlep"** mit dem Zustellcode | ☐ |
| H3 | Text der SMS lesen | Verständlich, deutsch, Code klar erkennbar | ☐ |
| H4 | Twilio → Messaging Logs | Nachricht mit Status `delivered` | ☐ |
| H5 | Lieferung mit **E-Mail** eines registrierten Kontos anlegen | Erscheint bei diesem Konto unter „Eingang" | ☐ |
| H6 | Konto mit Rolle „Empfangen" | Startet auf dem Eingang-Tab, **kann trotzdem senden** | ☐ |

---

## H2 · Chat

| # | Test | Erwartet | |
|---|---|---|---|
| H2.1 | Als **sender** den Chat zu einer Lieferung öffnen | Schnellantworten passen zur sendenden Rolle („Wo bist du gerade?"), **nicht** „Bin unterwegs" | ☐ |
| H2.2 | Als **driver** denselben Chat öffnen | Schnellantworten sind die des Fahrers („Bin unterwegs", „Verspäte mich etwas", „Bin da") | ☐ |
| H2.3 | Sprache auf FR/IT/EN stellen, Chat öffnen | Schnellantworten sind übersetzt, kein Englisch in der DE-Ansicht | ☐ |
| H2.4 | Schnellantwort antippen | Wird sofort gesendet und erscheint im Verlauf | ☐ |
| H2.5 | Nachricht auf dem zweiten Gerät | Kommt live an, ohne Neuladen | ☐ |

---

## I · Sicherheit & Privatsphäre

**Bitte nicht überspringen.** Diese Punkte sind vor echten Nutzern zu prüfen, nicht danach.

| # | Test | Erwartet | |
|---|---|---|---|
| I1 | Mit **third** einloggen und die Lieferungs-ID aus dem Test verwenden: <br>`curl https://api.shlep.ch/api/deliveries/<ID>/driver -H "Authorization: Bearer <token>"` | **403**, keine Fahrerdaten, kein Kennzeichen | ☐ |
| I2 | Als **third** versuchen, dieselbe Lieferung zu tracken | Wird abgelehnt | ☐ |
| I3 | Ausloggen → geschützten Screen aufrufen | Zurück zum Login | ☐ |
| I4 | Konto löschen | Funktioniert, Daten weg | ☐ |
| I5 | Zahlen-Tastatur: Zustellcode während der Eingabe | Nicht im App-Switcher-Vorschaubild sichtbar | ☐ |

> **I1 und I2 waren echte Lücken.** Jedes eingeloggte Konto konnte die Live-Position und das Kennzeichen einer beliebigen fahrenden Person abrufen. Behoben — bitte trotzdem gegenprüfen.

---

## J · Sprachen & Darstellung

| # | Test | Erwartet | |
|---|---|---|---|
| J1 | Sprache auf **FR** stellen, durch alle Hauptscreens | Keine englischen Reste, keine Schlüssel wie `sender.foo` | ☐ |
| J2 | Dasselbe auf **IT** | Dito | ☐ |
| J3 | Dasselbe auf **EN** | Dito | ☐ |
| J4 | Auf DE: lange Wörter in Buttons | Nichts abgeschnitten, kein Umbruch mitten im Wort | ☐ |
| J5 | App-Icon auf dem Homescreen | Grünes Feld mit amber „S" | ☐ |
| J6 | Splash-Screen beim Start | Shlep-Zeichen auf Papierfarbe | ☐ |
| J7 | Farben gegen shlep.ch halten | Gleiches Grün, gleiches Amber, gleicher Papierton | ☐ |
| J8 | Schriften gegen shlep.ch halten | Gleiche Anmutung (Bricolage / IBM Plex) | ☐ |
| J9 | Grösste Systemschrift einstellen (iOS-Einstellungen) | Nichts überlappt, alles bedienbar | ☐ |
| J10 | Dunkelmodus des Systems | App bleibt lesbar (sie ist bewusst hell) | ☐ |
| J11 | **Jeden** Unterbildschirm öffnen (Einstellungen, Verifizierung, Hilfe, Rechtliches, Route veröffentlichen, Zahlung) und wieder verlassen | Überall ein sichtbarer Zurück-Weg. Alle Stacks laufen ohne Systemkopfzeile — fehlt der eigene Zurück-Button, ist der Bildschirm eine Sackgasse | ☐ |

---

## K · Website & Partner

| # | Test | Erwartet | |
|---|---|---|---|
| K1 | shlep.ch auf dem Telefon öffnen | Lädt, mobil sauber | ☐ |
| K2 | Warteliste-Formular absenden | Erfolgsmeldung **und** Mail an `hello@shlep.ch` | ☐ |
| K3 | Kontaktformular absenden | Dito | ☐ |
| K4 | Flugmodus → Formular absenden | Fehlermeldung **und** mailto-Link, **kein** fälschlicher Erfolg | ☐ |
| K5 | shlep.ch/partner.html → Demo-Widget | Zeigt Preis; nach Deploy echte Verfügbarkeit statt Schätzwert | ☐ |
| K6 | Sprachumschalter auf der Website, alle vier | Keine Lücken | ☐ |
| K7 | shlep.ch/legal → Impressum | „DeltaSci Solutions GmbH" und `CHE-347.257.714` sichtbar | ☐ |
| K8 | Deep-Link `shlep.ch/new?fromLat=…` im Browser | Strecke vorausgefüllt | ☐ |

---

## L · Fehlerfälle

Hier bricht Software normalerweise. Bitte bewusst kaputt machen.

| # | Test | Erwartet | |
|---|---|---|---|
| L1 | Mitten in der Lieferungserstellung Flugmodus an, absenden | Klare Fehlermeldung, Eingaben bleiben erhalten | ☐ |
| L2 | Zweimal schnell hintereinander auf „Absenden" tippen | Nur **eine** Lieferung entsteht | ☐ |
| L3 | App während der Zahlung beenden, neu öffnen | Kein Geisterzustand, Lieferung eindeutig bezahlt oder nicht | ☐ |
| L4 | Lieferung nach Bezahlung, vor Abholung stornieren | Zahlung freigegeben/erstattet | ☐ |
| L5 | Fahrer lehnt nach Annahme ab | Lieferung wird wieder ausgeschrieben, Zahlung bleibt bestehen | ☐ |
| L6 | Sehr lange Beschreibung (500+ Zeichen) | Wird angenommen oder sauber begrenzt, kein Layoutbruch | ☐ |
| L7 | Betrag 0 oder negativ eingeben | Abgelehnt | ☐ |
| L8 | Emoji im Namen und in der Beschreibung | Wird korrekt gespeichert und angezeigt | ☐ |

---

## Ergebnis festhalten

```
Datum:        ____________
Build:        ____________  (npx eas-cli build:list --limit 1)
Geräte:       ____________
Bestanden:    ___ / 78
❌ Blocker:   ____________________________________________
⚠️ Kosmetik:  ____________________________________________
```

**Was ein Blocker ist:** alles in **I** (Sicherheit), C1–C4 (Zahlung), E1/E3 (Codes), A2/A3 (Zustellung von Mail und SMS). Ohne diese darf kein Build an externe Testerinnen.

**Was warten kann:** Kosmetik in J, G5 (Push-Ziel-Screen), L6–L8.

---

## Noch nicht implementiert — nicht testen

Damit du keine Zeit mit Dingen verlierst, die es bewusst noch nicht gibt:

- **Fahrer-Auszahlung.** Wartet auf Stripe Connect. Die App zeigt einen simulierten Status.
- **Ausweisprüfung (KYC).** Wartet auf Stripe Identity oder einen anderen Anbieter.
- **„Auf dieser Strecke anfragen"** auf dem Fahrer-Suchbildschirm — zeigt noch „Feature coming soon".
- **Push-Ziel-Screen.** Ein Tap öffnet die App, springt aber noch nicht zur Lieferung.
