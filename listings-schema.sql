-- Thrft marketplace listings
-- Paste into Supabase Dashboard → SQL Editor → Run
-- Requires Auth (auth.users). Uses new-style publishable/secret API keys from the client.

create extension if not exists "pgcrypto";

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  brand text not null default '',
  category text not null default '',
  price numeric(12, 2) not null default 0 check (price >= 0),
  condition text not null default '',
  description text not null default '',
  image_url text not null default 'placeholder',
  status text not null default 'available'
    check (status in ('available', 'sold', 'draft', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_seller_id_idx on public.listings (seller_id);
create index if not exists listings_brand_idx on public.listings (brand);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_created_at_idx on public.listings (created_at desc);

create or replace function public.set_listings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row
  execute function public.set_listings_updated_at();

alter table public.listings enable row level security;

-- Anyone can browse available listings (anon + authenticated).
drop policy if exists "listings_select_available" on public.listings;
create policy "listings_select_available"
  on public.listings
  for select
  to anon, authenticated
  using (status = 'available' or auth.uid() = seller_id);

-- Sellers insert their own rows.
drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings
  for insert
  to authenticated
  with check (auth.uid() = seller_id);

-- Sellers update / soft-remove their own rows.
drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings
  for delete
  to authenticated
  using (auth.uid() = seller_id);

comment on table public.listings is 'Thrft marketplace listings; seller_id = auth.users.id';
