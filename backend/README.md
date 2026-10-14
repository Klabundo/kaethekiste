# Backend (Supabase)

Supabase-Projekt mit Postgres-Datenbank, Foto-Storage und (optional) Realtime.
Die App selbst bleibt statisch und läuft weiter auf GitHub Pages – es werden
nur API-Calls statt localStorage genutzt.

## Dateien

| Datei | Zweck |
|---|---|
| `schema.sql` | Tabellen `fundsachen` + `zuordnungen`, RLS-Policies, Storage-Bucket „fotos“ (idempotent, mehrfaches Ausführen ok) |
| `seed.sql` | 11 Beispieldaten + 3 Zuordnungen (spiegelt `sampleItems()` aus `app.js`) |
| `sync-pages.sh` | Synchronisiert die App-Dateien ins GitHub-Page-Repo und pusht |
| `.env.example` | Vorlage für die Zugangsdaten (wird nie committet, nie ins Page-Repo kopiert) |

## Einrichten (einmalig, ca. 3 Minuten)

1. Kostenlosen Account: <https://supabase.com>
2. **New project** → Name `kkg-fundsachen`, Region **Frankfurt (Europe Central)**,
   ein beliebiges Datenbankpasswort wählen.
3. Zwei Werte hierher bringen (in `backend/.env`):
   - `PROJECT_URL` + `ANON_KEY`: Dashboard → **Project Settings → API**
   - `DATABASE_URL`: Dashboard → **Project Settings → Database** (Direktverbindung)
4. Schema + Daten anlegen:
   ```bash
   cd kkg-fundsachen/backend
   psql "$DATABASE_URL" -f schema.sql
   psql "$DATABASE_URL" -f seed.sql
   ```

## Zugriffsschutz (Prototyp-Modus, ohne Login)

- **RLS ist aktiviert.** Die Politik `fundsachen_prototyp` / `zuordnungen_prototyp`
  erlaubt der anonymen Rolle (also jedem, ohne Login) volle Lese-/Schreibrechte
  auf die beiden Tabellen – damit die Klasse ohne Konto melden kann.
- Alles andere im Supabase-Projekt (andere Schemas, interne Tabellen) bleibt geschützt.
- Der `ANON_KEY` ist dafür gemacht, öffentlich in der App zu stehen; der
  `service_role`-Key kommt bewusst nicht in die App.
- Hinweis: Ohne Login kann auch jeder mit dem Link Einträge löschen. Für den
  Prototyp vertretbar; für den „echten“ Betrieb würde man ein einfaches Login
  (Supabase Auth) davor schalten und die Policies entsprechend einschränken.
