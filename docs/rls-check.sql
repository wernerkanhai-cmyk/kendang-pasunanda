-- ═══════════════════════════════════════════════════════════════════════
-- KENDANG PASUNANDA — RLS-inspectie
-- Volledig READ-ONLY. Eén query, één resultaat.
--
-- Plak in Supabase > SQL Editor > Run. Klik de cel 'rapport' aan en
-- kopieer de volledige inhoud.
--
-- (De editor toont alleen het resultaat van de laatste query, vandaar dat
--  alles hier in één JSON-object zit in plaats van in losse selects.)
-- ═══════════════════════════════════════════════════════════════════════

select jsonb_pretty(jsonb_build_object(

  -- Staat RLS aan? rls_aan=false op ook maar één tabel betekent dat die
  -- tabel openligt voor elke ingelogde gebruiker, ongeacht de policies.
  'rls_status', (
    select jsonb_agg(jsonb_build_object(
             'tabel',      c.relname,
             'rls_aan',    c.relrowsecurity,
             'geforceerd', c.relforcerowsecurity,
             'policies',   (select count(*) from pg_policy p where p.polrelid = c.oid)
           ) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('songs','patterns','song_lines','measures',
                        'snippets','templates','snippet_templates')
  ),

  -- Directe eigenaar-kolommen (user_id / author_id).
  'eigenaar_kolommen', (
    select jsonb_agg(jsonb_build_object('tabel', table_name, 'kolom', column_name)
             order by table_name, column_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('songs','patterns','song_lines','measures',
                         'snippets','templates','snippet_templates')
      and column_name in ('user_id','author_id')
  ),

  -- Hoe hangen de geneste tabellen aan hun eigenaar? patterns, song_lines en
  -- measures hebben geen user_id, dus hun policy moet via deze koppelingen
  -- terug naar songs wijzen. Ontbreekt zo'n policy, dan is de muziekinhoud
  -- leesbaar ook als de songs-rij zelf afgeschermd is.
  --
  -- Uitgelezen uit de echte foreign keys in plaats van uit een lijst met
  -- geraden kolomnamen: measures koppelt via `line_id`, niet `song_line_id`,
  -- en dat miste een eerdere versie van dit script daardoor.
  'koppelingen', (
    select jsonb_agg(jsonb_build_object(
             'tabel',         src.relname,
             'kolom',         att.attname,
             'verwijst_naar', tgt.relname
           ) order by src.relname, att.attname)
    from pg_constraint con
    join pg_class     src on src.oid = con.conrelid
    join pg_class     tgt on tgt.oid = con.confrelid
    join pg_namespace ns  on ns.oid  = src.relnamespace
    join unnest(con.conkey) as ck(attnum) on true
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = ck.attnum
    where con.contype = 'f'
      and ns.nspname = 'public'
      and src.relname in ('songs','patterns','song_lines','measures',
                          'snippets','templates','snippet_templates')
  ),

  -- De policies zelf. 'true' in using betekent "iedereen mag alles zien".
  -- Voor templates/snippet_templates is dat bij SELECT bewust zo (gedeelde
  -- bibliotheek); voor songs/patterns/song_lines/measures/snippets NIET.
  'policies', (
    select jsonb_agg(jsonb_build_object(
             'tabel',      tablename,
             'voor',       cmd,
             'policy',     policyname,
             'rollen',     roles::text,
             'using',      coalesce(qual, '-'),
             'with_check', coalesce(with_check, '-')
           ) order by tablename, cmd, policyname)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('songs','patterns','song_lines','measures',
                        'snippets','templates','snippet_templates')
  ),

  -- Echte aantallen (draait als postgres, dus zonder RLS-filter).
  'rijen', jsonb_build_object(
    'songs',             (select count(*) from public.songs),
    'patterns',          (select count(*) from public.patterns),
    'song_lines',        (select count(*) from public.song_lines),
    'measures',          (select count(*) from public.measures),
    'snippets',          (select count(*) from public.snippets),
    'templates',         (select count(*) from public.templates),
    'snippet_templates', (select count(*) from public.snippet_templates),
    'gebruikers',        (select count(*) from auth.users)
  )

)) as rapport;
