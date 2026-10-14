# KätheKiste – Digitales Fundsachen-System (Prototyp)

Prototyp für das **Käthe-Kollwitz-Gymnasium (KKG)**: Ein digitales Fundsachen-System,
bei dem Verluste und Funde zentral gemeldet werden – und ein Matching-Algorithmus
automatisch erkennt, welche Verluste zu welchen Funden passen.

**Backend: Supabase (gemeinsame Datenbank):** Die App läuft statisch im Browser
(HTML + CSS + Vanilla JS, ohne Build-Schritt) – Einträge und Fotos liegen gemeinsam
in einer Supabase-Datenbank (Region Frankfurt), so dass alle am System dieselben
Daten in Echtzeit sehen. Kein Login nötig.

**Live:** <https://klabundo.github.io/kaethekiste/> (GitHub Pages – jede/r kann sie im Browser öffnen)

---

## So starte ich den Prototypen

1. **Online:** <https://klabundo.github.io/kaethekiste/> im Browser öffnen – fertig.
   Die 11 Beispieldaten (u. a. ein zugeordnetes iPhone-Paar und zwei abgeschlossene
   Fälle) liegen bereits in der gemeinsamen Datenbank.
2. **Oder lokal:** `index.html` im Browser öffnen – der Zugriff auf Supabase
   funktioniert auch ohne lokalen Webserver. (Falls gewünscht:
   `python3 -m http.server 8000` starten und http://localhost:8000 öffnen.)

## Features

| Feature | Beschreibung |
|---|---|
| **Verlust melden** | Formular mit Kategorie, Ort (KKG-Räume), Datum, Beschreibung, Foto |
| **Fund melden** | Gleiches Formular + Pflichtfeld „Weiterleitung an“ (z. B. Sekretariat) |
| **Smart Matching** | Während des Ausfüllens werden schon passende Gegenstücke gesucht; nach dem Absenden erscheinen konkrete Matches mit Ähnlichkeits-Score (Jaccard + Kategorie/Marken/Ort-Bonus) |
| **Zuordnungs-Workflow** | Match → „Zuordnen“ (beide Einträge in Abwicklung) → „Abholung bestätigen“ (beide erledigt). Freigabe läuft im echten Betrieb über Sekretariat/Lehrkraft |
| **Liste & Suche** | Freitextsuche (Live), Filter nach Art, Status, Kategorie, Ort |
| **Detailansicht** | Alle Angaben, Verlauf/Timeline, Kontakthinweis, Aktionen (Zuordnen, Abholen, Archivieren, Löschen) |
| **Übersicht (Dashboard)** | Offene Funde/Verluste, Erfolgsquote, Ø Zeit bis Abholung, Kategorien-Balken, letzte Aktivitäten |
| **Datenpflege** | Export/Import als JSON, Reset – die Daten liegen gemeinsam in der Cloud (Vorsicht: „Alle Daten löschen“ betrifft alle) |
| **Barrierearm** | Tastatur bedienbar (Enter/Space auf Karten, Esc schließt Dialogs), ARIA-Attribute, Skip-Link |

## Dateistruktur

```
kkg-fundsachen/
├── index.html      # Seitenstruktur (Header, Nav, Main, Footer, Modal, Toast)
├── style.css       # Design (reduziertes, editoriales Layout: Papier-Tonalität, Serifen-Headlines, ein Akzent)
├── app.js          # Logik: State, Supabase-Persistenz + Live-Sync, Matching, Views, Aktionen
├── static/
│   ├── supabase.js     # supabase-js (IIFE-Build, Global „SupabaseJS“) – wird mitdeployed
│   ├── logo-kkg.svg    # Original-Schullogo (Emblem + Schriftzug)
│   └── logo-emblem.svg # Nur das runde Emblem (Topbar, Footer, Favicon)
├── backend/
│   ├── schema.sql      # Tabellen fundsachen + zuordnungen, RLS, Storage-Policies
│   ├── seed.sql        # 11 Beispieldaten
│   ├── setup.sql       # Schema + Seed (einmalig)
│   ├── sync-pages.sh   # deployt die App auf GitHub Pages
│   └── README.md       # Backend-Doku (Setup, Sicherheit, Betrieb)
└── tests/
    └── smoke.js    # Headless-Test (Matching, Filter, Rendering + Persistenz gegen Mock)
```

## Ablauf (Rollen)

1. **Schüler:in** meldet Verlust oder Fund (Foto empfohlen).
2. **Algorithmus** schlägt passende Gegenstücke vor (ab ~35 % Ähnlichkeit, bei guter Übereinstimmung >80 %).
3. **Lehrkraft / Sekretariat** bestätigt die Zuordnung im System (im Prototyp: direkt per Button).
4. **Abholung** im Sekretariat gegen kurze Identifikation (z. B. Klassenzugehörigkeit, Merkmale beschreiben) → beide Einträge werden als „abgeholt“ abgeschlossen.

## Datenschutz (wichtig für den Schulalltag)

- Die Einträge liegen gemeinsam in einer Cloud-Datenbank (Supabase, Region Frankfurt)
  und sind für alle am System sichtbar – daher in den Meldungen bitte **keine**
  privaten Handynummern, Passwörter oder Adressen, sondern nur Angaben aus dem
  Schulkontext (Name/Klasse).
- Für den echten Betrieb wäre zu ergänzen: Login (Schulkontext), Datenverarbeitens-
  vereinbarung mit dem Anbieter, Löschfristen (z. B. 4 Wochen aktiv → Fundbüro/Archiv).

## Testen (optional)

```bash
node tests/smoke.js
```

Testet Matching-Algorithmus, Beispieldaten, Filter, Rendering – und die komplette
Persistenz (Laden, Foto-Upload, Melden, Zuordnen, Abholen, Löschen, Import,
Realtime-Änderungen, Reset) gegen eine In-Memory-Mock von Supabase.

## Nächste Schritte (Roadmap)

- [x] Gemeinsame Cloud-Datenbank (Supabase) mit Live-Synchronisation und Foto-Upload
- [ ] Login über Schulkonten (optional, für den Echtbetrieb)
- [ ] Benachrichtigung per E-Mail, wenn ein Match gefunden wurde
- [ ] „Fundbüro“-Ansicht für das Sekretariat mit Druckfunktion (Fundzettel, Etiketten)
- [ ] Lösch-/Archivierungsfristen automatisieren
- [ ] QR-Code für die physische Fundsachen-Dose → direkt zum Melden

---

*Prototyp erstellt als Schularbeit – Käthe-Kollwitz-Gymnasium, Oktober 2026.*
