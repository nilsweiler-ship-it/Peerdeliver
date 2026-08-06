# Shlep — QA-Protokoll vor Release

*Vor jedem Store-Release und vor jedem Build, den externe Testerinnen erhalten.*

Die Fehler, die uns bisher am meisten Zeit gekostet haben, waren **keine App-Fehler**. Es waren Umgebungs- und Konfigurationsprobleme: eine fehlende Abhängigkeit, ein Xcode-Update, ein Feld in `app.json`, das nie gesetzt war. Dieses Protokoll ist deshalb bewusst nach unten gebaut — Toolchain zuerst, Feature-Tests zuletzt.

**Regel:** Eine Stufe wird erst begonnen, wenn die vorherige vollständig grün ist. Ein Fehler in Stufe 1 macht jeden Test in Stufe 4 wertlos.

---

## Stufe 0 — Toolchain-Preflight (5 Min)

Hier entstanden die meisten verlorenen Stunden.

```bash
cd "$HOME/Peerdeliver"
npm run preflight
```

Prüft automatisch: alle vier nativen Module installiert, Icon deklariert, Bundle-ID korrekt, iOS- und Android-Standortberechtigungen gesetzt, EAS-projectId vorhanden, Produktions-API-URL korrekt, kein Platzhalter-Projekt im Repo-Root, keine `.env` im Git, i18n-Schlüssel in allen vier Sprachen identisch.

Zusätzlich von Hand:

```bash
cd packages/app && npx expo install --check && cd ../..
xcode-select -p                      # zeigt auf /Applications/Xcode.app/...
xcrun xctrace list devices | head    # Gerät sichtbar?
```

**Checkliste**

- [ ] `expo install --check` meldet keine Versionskonflikte
- [ ] Alle vier nativen Module aufgelöst
- [ ] Nach jedem Xcode-Update: einmal `npx expo run:ios` auf dem Simulator, bevor irgendetwas anderes getestet wird

> **Warum:** `expo-dev-client` fehlte tagelang unbemerkt. Die Folge war kein klarer Fehler, sondern ein `null` als Bundler-URL und ein Shake-Menü ohne Einträge — Symptome, die nach Netzwerkproblem aussehen. Ein Xcode-Major-Update hat zusätzlich Stripe (Enum-Mismatch), das Script-Sandboxing und den `devicectl`-Parser der Expo-CLI gebrochen. **Nach einem Xcode-Update ist ein Testbuild Pflicht, bevor Features getestet werden.**

---

## Stufe 1 — Automatisierte Prüfungen (2 Min)

```bash
cd "$HOME/Peerdeliver"
npx prisma generate --schema packages/server/prisma/schema.prisma
npx tsc -p packages/server/tsconfig.json --noEmit && \
npx tsc -p packages/app/tsconfig.json --noEmit && echo "TYPES GREEN"
```

- [ ] Beide Typechecks ohne Fehler
- [ ] `git status` sauber — nichts Ungespeichertes im Release-Build
- [ ] Keine Secrets im Repo: `git log --all -p -S "sk_live" --oneline | head`

---

## Stufe 2 — Build-Verifikation (20 Min)

- [ ] `npx expo prebuild --clean` aus **`packages/app`** (nicht aus dem Repo-Root — dort erzeugt Expo ein Platzhalter-Projekt)
- [ ] Bundle-ID im generierten Projekt ist `ch.shlep.app`: `grep -rm1 "ch.shlep" ios android`
- [ ] Berechtigungen vorhanden: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: location`, Android `ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE_LOCATION`
- [ ] App-Icon erscheint auf dem Homescreen (nicht der Expo-Platzhalter)
- [ ] Splash zeigt das Shlep-Zeichen
- [ ] Release-Build startet ohne Metro: `npx expo run:ios --device --configuration Release`

> Der letzte Punkt ist der wichtigste dieser Stufe. Ein Debug-Build lädt JavaScript vom Mac; der Store-Build muss es gebündelt enthalten. Dieser Unterschied fällt sonst erst im Review auf.

---

## Stufe 3 — Backend & Integrationen (15 Min)

Gegen **Produktion**, nicht gegen localhost.

```bash
curl -s https://api.shlep.ch/health
curl -s -X POST https://api.shlep.ch/api/partner/quote \
  -H "Content-Type: application/json" -H "X-Shlep-Key: pk_demo_shlep_2026" \
  -d '{"fromLat":47.3769,"fromLng":8.5417,"toLat":47.5001,"toLng":8.7501,"size":"large"}'
```

- [ ] `/health` antwortet `ok`
- [ ] Partner-Quote liefert Preis **und** `coverage` (beweist Postgres + PostGIS)
- [ ] Alle Env-Variablen in Render gesetzt: `RESEND_API_KEY`, `TWILIO_*`, `PAYREXX_*`, `PARTNER_API_KEYS`
- [ ] Testregistrierung → Willkommensmail landet im **Posteingang**, nicht im Spam
- [ ] SMS-Code kommt an (Twilio-Trial: Nummer muss unter *Verified Caller IDs* stehen)
- [ ] Payrexx-Webhook erreichbar: in deren Admin „Test senden" → Serverlog zeigt Eingang

---

## Stufe 4 — Funktionale Tests auf echtem Gerät

> **Vollständige Abnahme:** `MANUAL_TEST_PLAN.md` — 78 Einzeltests über alle
> Funktionen, mit Setup, erwartetem Ergebnis und Blocker-Definition. Die Liste
> unten ist die Kurzfassung für einen Bugfix-Release.

**Nie im Simulator abnehmen.** Simulator hat keine echte GPS, kein Push, keine Kamera, und er hängt die Mac-Tastatur ein — die Software-Tastatur erscheint gar nicht, weshalb Tastatur- und Scroll-Probleme dort unsichtbar bleiben. Genau so ist ein realer Bug (Zahlen-Tastatur ohne „Fertig") tagelang durchgerutscht.

### Registrierung & Rollen
- [ ] Registrierung mit Standardrolle (alle Rollen) ohne Fahrzeugangaben möglich
- [ ] Jede Rolle einzeln: korrekte Tabs sichtbar
- [ ] „Empfangen" gewählt → landet auf Eingang, kann trotzdem senden
- [ ] Route veröffentlichen ohne Fahrzeug → verständliche Fehlermeldung, kein Absturz

### Formulare (der bisher fehleranfälligste Bereich)
- [ ] **Jedes** Feld mit Zahlen-Tastatur: Tastatur lässt sich durch Wischen schliessen
- [ ] Formular bis zum Absenden-Button scrollbar, **während die Tastatur offen ist**
- [ ] Adress-Autovervollständigung liefert Dorf **und** Strassenadresse, nicht nur Städte
- [ ] Netzwerkfehler zeigt Fehlermeldung, nicht fälschlich Erfolg

### Lieferzyklus (zwei Geräte, zwei Konten)
- [ ] Anlegen → TWINT-Zahlung → Fahrer nimmt an → Abholcode → Zustellcode
- [ ] Live-Tracking bewegt sich beim Fahren
- [ ] **Telefon sperren, 200 m bewegen** → Karte des Senders aktualisiert weiter
- [ ] Nach Zustellung stoppt das Tracking
- [ ] Push kommt bei jedem Schritt an

### Sicherheit
- [ ] Mit Konto C eine fremde Lieferungs-ID tracken → wird abgelehnt
- [ ] `GET /deliveries/:id/driver` als Unbeteiligter → 403

### Sprachen
- [ ] DE/FR/IT/EN: keine fehlenden Schlüssel, keine abgeschnittenen Texte
- [ ] Lange deutsche Wörter brechen Buttons nicht

---

## Stufe 5 — Store-Review-Vorbereitung

- [ ] **Hintergrund-Standort begründet:** Apple prüft das streng. Review-Notiz: Tracking läuft ausschliesslich während einer aktiven Lieferung und stoppt automatisch danach. Muss zum deutschen Berechtigungstext passen.
- [ ] Demo-Konto mit Zugangsdaten hinterlegt, sonst kann Apple nichts testen
- [ ] Screenshots aller Pflichtgrössen
- [ ] Datenschutzerklärung erreichbar: shlep.ch/legal
- [ ] App Privacy: Standort, Kontaktdaten, Identifikatoren deklariert
- [ ] Google Play: Monetarisierung als physische Dienstleistung → von Play Billing ausgenommen (Formulierung mit der Apple-Notiz konsistent halten)
- [ ] Keine Platzhalter-, Test- oder Lorem-Texte in sichtbaren Screens

---

## Regressionsliste

Fehler, die schon einmal auftraten. Vor jedem Release erneut prüfen — sie kamen alle durch Umgebungsänderungen zurück, nicht durch neuen Code.

| # | Fehler | Schnellprüfung |
|---|---|---|
| 1 | `expo-dev-client` fehlt → Bundler-URL `null` | Stufe 0, Modulprüfung |
| 2 | Prebuild im Repo-Root statt `packages/app` | `ch.shlep.app` im Projekt suchen |
| 3 | Produktions-API zeigte auf nicht existierende Domain | `grep -r "api\..*\.ch" packages/app/src/services/api.ts` |
| 4 | Zahlen-Tastatur ohne Schliessmöglichkeit | Auf echtem Gerät, jedes Zahlenfeld |
| 5 | Kein App-Icon konfiguriert | Homescreen ansehen |
| 6 | Xcode-Update bricht native Abhängigkeiten | Nach jedem Update Testbuild |
| 7 | Formular meldet Erfolg trotz Fehler | Flugmodus, absenden |
| 8 | Fehlende i18n-Schlüssel | Alle vier Sprachen durchklicken |

---

## Zeitbedarf

| Stufe | Dauer |
|---|---|
| 0–1 automatisiert | 7 Min |
| 2 Build | 20 Min |
| 3 Backend | 15 Min |
| 4 Funktional (2 Geräte) | 60–90 Min |
| 5 Store-Vorbereitung | 30 Min |

**Rund 2,5 Stunden für einen vollständigen Durchlauf.** Für einen reinen Bugfix genügen Stufe 0–2 plus die betroffenen Punkte aus Stufe 4.
