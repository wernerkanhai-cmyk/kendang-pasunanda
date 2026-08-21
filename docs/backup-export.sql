-- ═══════════════════════════════════════════════════════════════════════
-- KENDANG PASUNANDA — handmatige back-up
--
-- Waarom: dit project draait op Supabase Pro, dat automatische dagelijkse
-- back-ups maakt met een beperkte bewaartermijn (standaard zeven dagen;
-- controleer de actuele termijn onder Database > Backups). Die dekken het
-- normale geval al af.
--
-- Dit script is de extra laag daarbovenop, voor wat de automatische back-ups
-- NIET dekken: iets dat je pas na de bewaartermijn ontdekt, en problemen met
-- het account of de organisatie zelf. Een kopie buiten Supabase kost je een
-- minuut en is dan het verschil. Geen haast, wel goed om af en toe te doen.
--
-- Gebruik: plak in Supabase > SQL Editor > Run, dan Export > Download CSV.
-- Bewaar dat bestand ergens buiten Supabase (Dropbox, externe schijf).
-- Read-only: dit leest alleen, het verandert niets.
--
-- Let op: het bestand bevat de e-mailadressen van je gebruikers. Behandel
-- het als privacygevoelig — geen wachtwoorden, wel persoonsgegevens.
-- ═══════════════════════════════════════════════════════════════════════

select jsonb_build_object(

  'geexporteerd_op', now(),

  -- Wie is wie. Nodig om te weten welke user_id bij welke gebruiker hoort;
  -- zonder dit is een teruggezette song niet aan een account te koppelen.
  'gebruikers', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', u.id, 'email', u.email, 'created_at', u.created_at
           ) order by u.created_at), '[]'::jsonb)
    from auth.users u
  ),

  -- De vier tabellen van de songboom, elk als platte lijst. Terugzetten gaat
  -- per tabel in deze volgorde, zodat de foreign keys steeds al bestaan.
  'songs',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.songs      t),
  'patterns',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.patterns   t),
  'song_lines', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.song_lines t),
  'measures',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.measures   t),

  -- De losse bibliotheken.
  'snippets',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.snippets          t),
  'templates',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.templates         t),
  'snippet_templates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.snippet_templates t)

)::text as backup;
