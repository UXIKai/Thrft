-- Run after creator-pipeline.sql. Public identity is separate from private preferences.
create table if not exists public.creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{1,40}$'),
  display_name text not null default '',
  avatar_url text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now()
);
create or replace function public.sync_creator_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  handle text;
begin
  handle := left(regexp_replace(lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''),
    nullif(split_part(new.email, '@', 1), ''), 'member')), '[^a-z0-9_]', '', 'g'), 24);
  if handle = '' then handle := 'member'; end if;
  if tg_op = 'UPDATE' and new.raw_user_meta_data->>'username' is not distinct from old.raw_user_meta_data->>'username'
    and new.email is not distinct from old.email then
    handle := coalesce((select username from creator_profiles where id = new.id), handle);
  end if;
  if coalesce(new.raw_user_meta_data->>'username', '') = '' and exists (
    select 1 from creator_profiles where username = handle and id <> new.id
  ) then
    handle := left(handle, 7) || '_' || replace(new.id::text, '-', '');
  end if;
  insert into creator_profiles (id, username, display_name, avatar_url, bio, created_at)
  values (new.id, handle, coalesce(new.raw_user_meta_data->>'displayName',
    new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', handle),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    coalesce(new.raw_user_meta_data->>'bio', ''), new.created_at)
  on conflict (id) do update set username = excluded.username,
    display_name = excluded.display_name, avatar_url = excluded.avatar_url, bio = excluded.bio;
  return new;
end;
$$;
drop trigger if exists sync_creator_profile on auth.users;
create trigger sync_creator_profile after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.sync_creator_profile();
-- Backfill without rewriting Auth. Duplicate historical handles receive a UUID suffix.
with names as (
  select u.*, coalesce(nullif(left(regexp_replace(lower(coalesce(nullif(raw_user_meta_data->>'username', ''),
    nullif(split_part(email, '@', 1), ''), 'member')), '[^a-z0-9_]', '', 'g'), 24), ''), 'member') as handle
  from auth.users u
), ranked as (
  select n.*, row_number() over (partition by handle order by created_at, id) as position from names n
)
insert into public.creator_profiles (id, username, display_name, avatar_url, bio, created_at)
select r.id, case when position > 1 or exists (
    select 1 from creator_profiles p where p.username = r.handle and p.id <> r.id
  ) then left(r.handle, 7) || '_' || replace(r.id::text, '-', '') else r.handle end,
  coalesce(r.raw_user_meta_data->>'displayName', r.raw_user_meta_data->>'full_name',
    r.raw_user_meta_data->>'name', r.handle),
  coalesce(r.raw_user_meta_data->>'avatar_url', r.raw_user_meta_data->>'picture', ''),
  coalesce(r.raw_user_meta_data->>'bio', ''), r.created_at
from ranked r where not exists (select 1 from creator_profiles p where p.id = r.id)
on conflict (id) do nothing;
revoke all on function public.sync_creator_profile() from public, anon, authenticated;
alter table public.creator_profiles enable row level security;
create table if not exists public.creator_profile_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb
);
alter table public.creator_profile_preferences enable row level security;
drop policy if exists "Read own preferences" on public.creator_profile_preferences;
create policy "Read own preferences" on public.creator_profile_preferences
  for select to authenticated using (user_id = auth.uid());
create table if not exists public.creator_follows (
  follower_id uuid not null references public.creator_profiles(id) on delete cascade,
  followed_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists creator_follows_target on public.creator_follows (followed_id);
alter table public.creator_follows enable row level security;
drop policy if exists "Read follows" on public.creator_follows;
create policy "Read follows" on public.creator_follows for select using (true);
drop policy if exists "Follow as self" on public.creator_follows;
create policy "Follow as self" on public.creator_follows for insert to authenticated
  with check (follower_id = auth.uid());
drop policy if exists "Unfollow as self" on public.creator_follows;
create policy "Unfollow as self" on public.creator_follows for delete to authenticated
  using (follower_id = auth.uid());
create or replace view public.creator_public_profiles as
select p.*, (select count(*) from public.creator_follows f where f.follower_id = p.id) as following_count,
  (select count(*) from public.creator_follows f where f.followed_id = p.id) as follower_count
from public.creator_profiles p;

create table if not exists public.creator_saved_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  source text not null check (source in ('store', 'market')),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.creator_saved_products enable row level security;
drop policy if exists "Read own saved products" on public.creator_saved_products;
create policy "Read own saved products" on public.creator_saved_products
  for select to authenticated using (user_id = auth.uid());
create or replace function public.replace_creator_saved_products(owner_id uuid, products jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from creator_saved_products where user_id = owner_id;
  insert into creator_saved_products (user_id, product_id, source)
    select owner_id, (entry->>'product_id')::uuid, entry->>'source'
    from jsonb_array_elements(products) entry;
end;
$$;
revoke all on function public.replace_creator_saved_products(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_creator_saved_products(uuid, jsonb) to service_role;

-- Estimated gross product margin from verified paid orders; shipping and fees are excluded.
create or replace view public.creator_leaderboard as
with margins as (
  select coalesce((item->>'creatorId')::uuid, p.creator_id) as creator_id,
    ((item->>'unitAmount')::numeric - coalesce((item->>'baseAmount')::numeric,
      (select (v->>'base_price')::numeric * 100 from jsonb_array_elements(p.printful_variants) v
        where (v->>'variant_id')::integer = (item->>'printfulVariantId')::integer
          and v->>'currency' = 'USD' limit 1))) * (item->>'quantity')::integer as margin
  from public.creator_checkout_orders o
  cross join lateral jsonb_array_elements(o.items) item
  left join public.brand_products p on p.id = (item->>'productId')::uuid
  where o.payment_status = 'paid' and o.currency = 'usd'
), totals as (
  select creator_id, sum(margin) / 100 as profit from margins
  where margin is not null group by creator_id
)
select p.id, p.username, p.display_name, p.avatar_url, t.profit
from totals t join public.creator_profiles p on p.id = t.creator_id;

revoke all on public.creator_profiles, public.creator_public_profiles,
  public.creator_profile_preferences, public.creator_saved_products, public.creator_leaderboard, public.creator_follows
  from anon, authenticated;
grant select on public.creator_profile_preferences, public.creator_saved_products to authenticated;
grant select, insert, delete on public.creator_follows to authenticated;
grant select on public.creator_follows to anon;
grant all on public.creator_profiles, public.creator_public_profiles, public.creator_follows,
  public.creator_profile_preferences, public.creator_saved_products, public.creator_leaderboard to service_role;
