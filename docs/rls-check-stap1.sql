-- ═══════════════════════════════════════════════════════════════════════
-- KENDANG PASUNANDA — RLS-inspectie, STAP 1 van 2
-- Volledig READ-ONLY. Verandert niets. Plak in Supabase > SQL Editor > Run.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Staat RLS überhaupt aan? ────────────────────────────────────────
-- rls_aan=false op ook maar één tabel = alles ligt open voor elke
-- ingelogde gebruiker, ongeacht wat de policies zeggen.
select
  c.relname                                                   as tabel,
  c.relrowsecurity                                            as rls_aan,
  c.relforcerowsecurity                                       as rls_geforceerd,
  (select count(*) from pg_policy p where p.polrelid = c.oid)  as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('songs','patterns','song_lines','measures',
                    'snippets','templates','snippet_templates')
order by c.relname;


-- ── 2. Welke eigenaar-kolom heeft elke tabel? ──────────────────────────
-- songs/snippets horen user_id te hebben, templates author_id.
-- patterns/song_lines/measures hebben er géén: die moeten hun policy
-- via een subquery naar songs leggen. Dat checkt query 3.
select table_name as tabel, column_name as kolom, data_type as type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('songs','patterns','song_lines','measures',
                     'snippets','templates','snippet_templates')
  and column_name in ('id','user_id','author_id','song_id','pattern_id','song_line_id')
order by table_name, column_name;


-- ── 3. De policies zelf ────────────────────────────────────────────────
-- Let op 'true' in using_expressie: dat betekent "iedereen mag alles zien".
-- Voor templates/snippet_templates is dat bij SELECT bewust zo (gedeelde
-- bibliotheek); voor songs/patterns/song_lines/measures/snippets NIET.
select
  tablename                  as tabel,
  cmd                        as voor,
  policyname                 as policy,
  roles::text                as rollen,
  coalesce(qual, '—')        as using_expressie,
  coalesce(with_check, '—')  as with_check_expressie
from pg_policies
where schemaname = 'public'
  and tablename in ('songs','patterns','song_lines','measures',
                    'snippets','templates','snippet_templates')
order by tablename, cmd, policyname;


-- ── 4. Hoeveel data staat er echt in? ──────────────────────────────────
-- Dit draait als postgres en negeert RLS, dus dit is de waarheid.
-- Zo weten we of "0 rijen zichtbaar" van buitenaf komt doordat RLS werkt,
-- of gewoon doordat de tabel leeg is.
select 'songs'             as tabel, count(*) as rijen from public.songs
union all select 'patterns',          count(*) from public.patterns
union all select 'song_lines',        count(*) from public.song_lines
union all select 'measures',          count(*) from public.measures
union all select 'snippets',          count(*) from public.snippets
union all select 'templates',         count(*) from public.templates
union all select 'snippet_templates', count(*) from public.snippet_templates
union all select 'auth.users',        count(*) from auth.users
order by tabel;


-- ── 5. Zijn er twee eigenaren om mee te testen? ────────────────────────
-- Geeft dit een fout over een onbekende kolom, sla 'm dan over en stuur
-- de rest; dan pas ik stap 2 aan op de echte kolomnamen uit query 2.
select
  u.id                                                                as user_id,
  u.email,
  u.created_at::date                                                  as sinds,
  (select count(*) from public.songs    s  where s.user_id  = u.id)   as songs,
  (select count(*) from public.snippets sn where sn.user_id = u.id)   as snippets
from auth.users u
order by u.created_at;
