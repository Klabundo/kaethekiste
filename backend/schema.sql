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
