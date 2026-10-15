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
   'handy', '', 'Weiß', 'Flur 1. OG', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000001.jpg', 'in_abwicklung', 'Lena M. (9.2)', 'Abgabe: Sekretariat',
   now() - interval '3 days', now() - interval '3 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '3 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)')
   )),

  ('a0000000-0000-4000-8000-000000000002', 'lost',
   'iPhone 14, weiß, Stern-Hülle',
   'iPhone 14 weiß, Hülle mit kleinen Sternen. Bitte dringend!',
   'handy', '', 'Weiß', 'Flur 1. OG', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000002.jpg', 'in_abwicklung', 'Sami K. (9.1)', '',
   now() - interval '2 days', now() - interval '2 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Verlust gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)')
   )),

  ('a0000000-0000-4000-8000-000000000003', 'found',
   'Schwarze Puma-Jacke, Größe M',
   'Schwarze Puma-Trainingsjacke Größe M, lag auf der Bank in der Sporthalle.',
   'kleidung', 'Puma', 'Schwarz', 'Turnhalle / Sporthalle', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000003.jpg', 'abgeholt', 'Tom R. (10.1)', 'Abgabe: Sekretariat',
   now() - interval '6 days', now() - interval '6 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '6 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '4 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000004', 'lost',
   'Puma-Jacke, schwarz, Größe M',
   'Nach dem Sport die Puma-Jacke verloren, schwarz, Größe M.',
   'kleidung', 'Puma', 'Schwarz', 'Turnhalle / Sporthalle', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000004.jpg', 'abgeholt', 'Ela B. (10.2)', '',
   now() - interval '5 days', now() - interval '5 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Verlust gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '4 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000005', 'found',
   'Grünes Stifte-Set (5×)',
   'Fünf grüne Kugelschreiber in einer kleinen Schachtel.',
   'stifte', '', 'Grün', 'Flur 2. OG', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000005.jpg', 'abgeholt', 'Mira S. (7.3)', 'Abgabe: Sekretariat',
   now() - interval '9 days', now() - interval '9 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '9 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '7 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000006', 'lost',
   'Fünf grüne Kugelschreiber',
   'Ganzes Stifte-Set (5×) verloren, alle grün.',
   'stifte', '', 'Grün', 'Flur 2. OG', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000006.jpg', 'abgeholt', 'Ben H. (7.1)', '',
   now() - interval '8 days', now() - interval '8 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '8 days') * 1000)::bigint, 'text', 'Verlust gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '7 days') * 1000)::bigint, 'text', 'Zuordnung bestätigt (Match)'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Abholung bestätigt – Sache erledigt')
   )),

  ('a0000000-0000-4000-8000-000000000007', 'found',
   'Casio-Rechner fx-991EX',
   'Lag auf dem Tisch im Kopierraum, Casio fx-991EX.',
   'rechner', 'Casio', 'Schwarz', 'Kopierraum', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000007.jpg', 'offen', 'Jonas P. (12.3)', 'Abgabe: Sekretariat',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000008', 'found',
   'Rote Lunchbox mit Katzen-Aufkleber',
   'Rote Lunchbox, leer, mit Katzen-Aufkleber.',
   'essen', '', 'Rot', 'Mensa / Cafeteria', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000008.jpg', 'offen', 'Mila T. (6.3)', 'Abgabe: Cafeteria',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000009', 'found',
   'Blauer Rucksack, voll mit Büchern',
   'Blaue Schultasche, voll mit Büchern, am Zaun im Pausenhof gefunden.',
   'nichting', '', 'Blau', 'Pausenhof', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000009.jpg', 'offen', 'anonym', 'Abgabe: Sekretariat',
   now() - interval '4 days', now() - interval '4 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '4 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000a', 'lost',
   'Schülerausweis, Elena Berger (11.1)',
   'Schülerausweis verloren, Name: Elena Berger, 11.1. Bitte melden!',
   'ausweis', '', '', 'Mensa / Cafeteria', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-00000000000a.jpg', 'offen', 'Elena B. (11.1)', '',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000b', 'lost',
   'Grüne Thermosflasche',
   'Grüne Thermosflasche, vermutlich in der Mensa, mit Gravur „N.F.“.',
   'flasche', '', 'Grün', 'Mensa / Cafeteria', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-00000000000b.jpg', 'offen', 'Nora F. (8.2)', '',
   now() - interval '2 days', now() - interval '2 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000c', 'found',
   'Schlüsselbund mit gelbem Hund-Anhänger',
   'Schlüssel mit gelbem Hund-Charms, lag in einem Briefkasten im 1. OG.',
   'schluessel', '', 'Gelb', 'Briefkasten 1. OG', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-00000000000c.jpg', 'offen', 'Jonas P. (12.3)', 'Abgabe: Sekretariat',
   now() - interval '2 days', now() - interval '2 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000d', 'found',
   'Taschenbuch „Der kleine Prinz“',
   'Taschenbuch, lag auf einem Sitzplatz in der Bibliothek.',
   'buecher', '', '', 'Bibliothek', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-00000000000d.jpg', 'offen', 'Frau Brandt', 'Abgabe: Bibliothek',
   now() - interval '5 days', now() - interval '5 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint, 'text', 'Fund gemeldet')
   )),

  ('a0000000-0000-4000-8000-00000000000e', 'found',
   'Blaue Mütze mit weißem Bommel',
   'Wollmütze mit Bommel, lag nach der großen Pause in der Aula.',
   'kleidung', '', 'Blau', 'Aula', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-00000000000e.jpg', 'archiviert', 'anonym', 'Abgabe: Sekretariat',
   now() - interval '21 days', now() - interval '21 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '21 days') * 1000)::bigint, 'text', 'Fund gemeldet'),
     jsonb_build_object('ts', (extract(epoch from now() - interval '7 days') * 1000)::bigint, 'text', 'Archiviert')
   )),

  ('a0000000-0000-4000-8000-00000000000f', 'lost',
   'Weiße AirPods Pro im Ladeetui',
   'AirPods Pro im weißen Etui, vermutlich im Musiksaal verloren.',
   'kopfhörer', '', 'Weiß', 'Musiksaal', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-00000000000f.jpg', 'offen', 'Jule H. (11.3)', '',
   now() - interval '1 days', now() - interval '1 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '1 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000010', 'lost',
   'Grünes Matheheft (9.3)',
   'Grünes Matheheft mit Stempeln, im Klassenzimmer 9.3 vergessen.',
   'hefte', '', 'Grün', 'Raum 9.3', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000010.jpg', 'offen', 'Max W. (9.3)', '',
   now() - interval '3 days', now() - interval '3 days',
   jsonb_build_array(
     jsonb_build_object('ts', (extract(epoch from now() - interval '3 days') * 1000)::bigint, 'text', 'Verlust gemeldet')
   )),

  ('a0000000-0000-4000-8000-000000000011', 'lost',
   'Schwarzer Regenschirm',
   'Schwarzer Regenschirm, nach dem Regen im Pausenhof vergessen.',
   'sonstiges', '', 'Schwarz', 'Pausenhof', 'https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/a0000000-0000-4000-8000-000000000011.jpg', 'offen', 'Finn G. (8.1)', '',
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
