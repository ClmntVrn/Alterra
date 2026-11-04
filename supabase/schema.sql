-- Base en ligne d’Alterra (Supabase). À coller une fois dans l’éditeur SQL du projet
-- (SQL Editor → New query → Run). Le script peut être relancé sans perte de données.
--
-- Une seule table suit les collections de la base locale : chaque ligne est un enregistrement
-- (séance, course, fiche…) d’un compte, stocké tel quel en JSON. Les règles d’accès (RLS)
-- n’autorisent un compte connecté qu’à lire et écrire ses propres lignes.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (
    collection in (
      'workouts',
      'activities',
      'personalRaces',
      'raceCatalog',
      'racePlans',
      'nutritionProducts',
      'equipment'
    )
  ),
  id text not null check (length(id) between 1 and 200),
  -- Enregistrement complet ; null pour une suppression.
  data jsonb,
  deleted boolean not null default false,
  -- Heure de la modification sur l’appareil : la plus récente l’emporte.
  modified_at timestamptz not null,
  -- Heure d’écriture sur le serveur : repère des appareils pour récupérer les nouveautés.
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id),
  check (deleted or (data is not null and data ->> 'id' = id))
);

create index if not exists records_user_updated on public.records (user_id, updated_at);

-- Heure serveur à chaque écriture ; une modification plus ancienne que celle enregistrée
-- (appareil resté hors ligne) est ignorée.
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.modified_at < old.modified_at then
    return null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
before insert or update on public.records
for each row execute function public.records_before_write();

alter table public.records enable row level security;

drop policy if exists "Lecture de ses lignes" on public.records;
create policy "Lecture de ses lignes" on public.records
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Ajout de ses lignes" on public.records;
create policy "Ajout de ses lignes" on public.records
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Modification de ses lignes" on public.records;
create policy "Modification de ses lignes" on public.records
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Suppression de ses lignes" on public.records;
create policy "Suppression de ses lignes" on public.records
for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- Suppression du compte connecté et, en cascade, de toutes ses lignes.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
