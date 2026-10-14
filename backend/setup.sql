-- ============================================================
-- KätheKiste – Supabase-Setup in einem Rutsch
-- Verwendung: Inhalt in den SQL-Editor des Supabase-Dashboards
-- kopieren und „Run“ klicken. Oder: backend/setup.sql von einer
-- Kommandozeile mit psql/Supabase-CLI ausführen.
-- Enthalten: Schema + RLS + Storage + Beispieldaten + Verifikation
-- Wiedervollzug sicher (idempotente DDL, Seeds mit on conflict).
-- ============================================================

-- ============================================================
-- KätheKiste – Supabase-Schema (Postgres 15+)
-- Prototyp-Modus: anonyme Zugriffe, kein Login
-- Wiedervollzug sicher: idempotente DDL (if not exists / drop if exists)
-- ============================================================

-- ---------- Tabellen ----------

create table if not exists fundsachen (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('lost', 'found')),
  title       text not null,
  description text not null default '',
  category    text not null default 'sonstiges',
  brand       text not null default '',
  color       text not null default '',
  location    text not null default '',
  photo       text not null default '',
  status      text not null default 'offen'
              check (status in ('offen', 'in_abwicklung', 'abgeholt', 'archiviert')),
  reporter    text not null default '',
  contact     text not null default '',
  reported_at timestamptz not null default now(),  -- Formularfeld „Wann gefunden/verschwunden?“
  events      jsonb not null default '[]'::jsonb,  -- Verlaufs-Log [{ts, text}] (Timeline im Detail)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migration 2026-10-14: zwei neue Spalten für bereits existierende Projekte
alter table fundsachen add column if not exists reported_at timestamptz not null default now();
alter table fundsachen add column if not exists events jsonb not null default '[]'::jsonb;

create table if not exists zuordnungen (
  id         uuid primary key default gen_random_uuid(),
  item_a     uuid not null references fundsachen (id) on delete cascade,
  item_b     uuid not null references fundsachen (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint zuordnungen_paar unique (item_a, item_b)
);

create index if not exists fundsachen_status_idx on fundsachen (status);
create index if not exists fundsachen_created_idx on fundsachen (created_at desc);

-- ---------- updated_at-Trigger ----------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists fundsachen_updated on fundsachen;
create trigger fundsachen_updated
  before update on fundsachen
  for each row execute function set_updated_at();

-- ---------- Row Level Security ----------
-- Prototyp ohne Login: die anonyme Rolle darf auf beide Tabellen
-- frei lesen/schreiben. (Bewusst: sonst könnte die Klasse nichts melden.)
-- Alles andere im Supabase-Projekt bleibt durch RLS geschützt.

alter table fundsachen enable row level security;
alter table zuordnungen enable row level security;

drop policy if exists "fundsachen_prototyp" on fundsachen;
create policy "fundsachen_prototyp"
  on fundsachen for all
  to anon
  using (true) with check (true);

drop policy if exists "zuordnungen_prototyp" on zuordnungen;
create policy "zuordnungen_prototyp"
  on zuordnungen for all
  to anon
  using (true) with check (true);

grant usage on schema public to anon;
grant select, insert, update, delete on fundsachen, zuordnungen to anon;

-- ---------- Foto-Storage ----------

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos_lesen" on storage.objects;
create policy "fotos_lesen"
  on storage.objects for select
  to anon
  using (bucket_id = 'fotos');

drop policy if exists "fotos_hochladen" on storage.objects;
create policy "fotos_hochladen"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'fotos');

drop policy if exists "fotos_loeschen" on storage.objects;
create policy "fotos_loeschen"
  on storage.objects for delete
  to anon
  using (bucket_id = 'fotos');

-- ============================================================
-- KätheKiste – Beispieldaten (17 Einträge + 3 Zuordnungen)
-- Spiegelt exakt sampleItems() aus app.js (Vorlage für die Demo).
-- Wiedervollzug: on conflict do nothing → keine Duplikate.
-- reported_at = created_at (Meldedatum == Erfassungszeitpunkt),
-- events = Verlaufs-Log (Timestamps in Millisekunden-Epoch).
--
-- Vollständiger Neustart (z. B. nach Änderungen):
--   delete from zuordnungen;
--   delete from fundsachen;
--   -- dann diese Datei ausführen
-- ============================================================

insert into fundsachen
  (id, type, title, description, category, brand, color, location, photo, status, reporter, contact, reported_at, created_at, events)
values
  ('a0000000-0000-4000-8000-000000000001', 'found',
   'Weißes iPhone 14 mit Stern-Hülle',
   'Im Briefkasten des 1. OG gefunden. Gehäuse weiß, Hülle mit kleinen Sternen, Code gesperrt.',
   'handy', '', 'Weiß', 'Flur 1. OG', '', 'in_abwicklung', 'Lena M. (9b)', 'Abgabe: Sekretariat',
   now() - interval '3 days', now() - interval '3 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '3 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)')
   )),

  ('a0000000-0000-4000-8000-000000000002', 'lost',
   'iPhone 14, weiß, Stern-Hülle',
   'iPhone 14 weiß, Hülle mit kleinen Sternen. Bitte dringend!',
   'handy', '', 'Weiß', 'Flur 1. OG', '', 'in_abwicklung', 'Sami K. (9a)', '',
   now() - interval '2 days', now() - interval '2 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Verlust gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)')
   )),

  ('a0000000-0000-4000-8000-000000000003', 'found',
   'Schwarze Puma-Jacke, Größe M',
   'Schwarze Puma-Trainingsjacke Größe M, lag auf der Bank in der Sporthalle.',
   'kleidung', 'Puma', 'Schwarz', 'Turnhalle / Sporthalle', '', 'abgeholt', 'Tom R. (10a)', 'Abgabe: Sekretariat',
   now() - interval '6 days', now() - interval '6 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '6 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '4 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000004', 'lost',
   'Puma-Jacke, schwarz, Größe M',
   'Nach dem Sport die Puma-Jacke verloren, schwarz, Größe M.',
   'kleidung', 'Puma', 'Schwarz', 'Turnhalle / Sporthalle', '', 'abgeholt', 'Ela B. (10b)', '',
   now() - interval '5 days', now() - interval '5 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Verlust gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '4 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000005', 'found',
   'Grünes Stifte-Set (5×)',
   'Fünf grüne Kugelschreiber in einer kleinen Schachtel.',
   'stifte', '', 'Grün', 'Flur 2. OG', '', 'abgeholt', 'Mira S. (7c)', 'Abgabe: Sekretariat',
   now() - interval '9 days', now() - interval '9 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '9 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '7 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000006', 'lost',
   'Fünf grüne Kugelschreiber',
   'Ganzes Stifte-Set (5×) verloren, alle grün.',
   'stifte', '', 'Grün', 'Flur 2. OG', '', 'abgeholt', 'Ben H. (7a)', '',
   now() - interval '8 days', now() - interval '8 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '8 days') * 1000)::bigint, 'text', 'Verlust gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '7 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000007', 'found',
   'Casio-Rechner fx-991EX',
   'Lag auf dem Tisch im Kopierraum, Casio fx-991EX.',
   'rechner', 'Casio', 'Schwarz', 'Kopierraum', '', 'offen', 'Jonas P. (12c)', 'Abgabe: Sekretariat',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000008', 'found',
   'Rote Lunchbox mit Katzen-Aufkleber',
   'Rote Lunchbox, leer, mit Katzen-Aufkleber.',
   'essen', '', 'Rot', 'Mensa / Cafeteria', '', 'offen', 'Mila T. (6c)', 'Abgabe: Cafeteria',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000009', 'found',
   'Blauer Rucksack, voll mit Büchern',
   'Blaue Schultasche, voll mit Büchern, am Zaun im Pausenhof gefunden.',
   'nichting', '', 'Blau', 'Pausenhof', '', 'offen', 'anonym', 'Abgabe: Sekretariat',
   now() - interval '4 days', now() - interval '4 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '4 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000a', 'lost',
   'Schülerausweis, Elena Berger (11a)',
   'Schülerausweis verloren, Name: Elena Berger, 11a. Bitte melden!',
   'ausweis', '', '', 'Mensa / Cafeteria', '', 'offen', 'Elena B. (11a)', '',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000b', 'lost',
   'Grüne Thermosflasche',
   'Grüne Thermosflasche, vermutlich in der Mensa, mit Gravur „N.F.“.',
   'flasche', '', 'Grün', 'Mensa / Cafeteria', '', 'offen', 'Nora F. (8b)', '',
   now() - interval '2 days', now() - interval '2 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000c', 'found',
   'Schlüsselbund mit gelbem Hund-Anhänger',
   'Schlüssel mit gelbem Hund-Charms, lag in einem Briefkasten im 1. OG.',
   'schluessel', '', 'Gelb', 'Briefkasten 1. OG', '', 'offen', 'Jonas P. (12c)', 'Abgabe: Sekretariat',
   now() - interval '2 days', now() - interval '2 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000d', 'found',
   'Taschenbuch „Der kleine Prinz“',
   'Taschenbuch, lag auf einem Sitzplatz in der Bibliothek.',
   'buecher', '', '', 'Bibliothek', '', 'offen', 'Frau Brandt', 'Abgabe: Bibliothek',
   now() - interval '5 days', now() - interval '5 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000e', 'found',
   'Blaue Mütze mit weißem Bommel',
   'Wollmütze mit Bommel, lag nach der großen Pause in der Aula.',
   'kleidung', '', 'Blau', 'Aula', '', 'archiviert', 'anonym', 'Abgabe: Sekretariat',
   now() - interval '21 days', now() - interval '21 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '21 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '7 days') * 1000)::bigint, 'text', 'Archiviert')
   )),

  ('a0000000-0000-4000-8000-00000000000f', 'lost',
   'Weiße AirPods Pro im Ladeetui',
   'AirPods Pro im weißen Etui, vermutlich im Musiksaal verloren.',
   'kopfhörer', '', 'Weiß', 'Musiksaal', '', 'offen', 'Jule H. (11c)', '',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000010', 'lost',
   'Grünes Matheheft (9c)',
   'Grünes Matheheft mit Stempeln, im Klassenzimmer 9c vergessen.',
   'hefte', '', 'Grün', 'Raum 9c', '', 'offen', 'Max W. (9c)', '',
   now() - interval '3 days', now() - interval '3 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '3 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000011', 'lost',
   'Schwarzer Regenschirm',
   'Schwarzer Regenschirm, nach dem Regen im Pausenhof vergessen.',
   'sonstiges', '', 'Schwarz', 'Pausenhof', '', 'offen', 'Finn G. (8a)', '',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   ))
on conflict (id) do nothing;

-- Zuordnungen: iPhone-Paar (in Abwicklung), Puma-Paar (abgeholt), Stifte-Paar (abgeholt)
insert into zuordnungen (item_a, item_b)
values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000006')
on conflict (item_a, item_b) do nothing;

-- ---------- Verifikation ----------
select count(*) as fundsachen from fundsachen;
select count(*) as zuordnungen from zuordnungen;
select id, status, reported_at is not null as hat_datum, jsonb_array_length(events) as ereignisse
  from fundsachen order by id limit 3;
