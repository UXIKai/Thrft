-- Run after supabase/creator-pipeline.sql. All writes go through the authenticated API.
create table if not exists public.external_brands (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id),
  site_origin text not null,
  name text not null,
  logo_url text not null,
  created_at timestamptz not null default now(),
  unique (creator_id, site_origin)
);
alter table public.external_brands enable row level security;
revoke all on public.external_brands from anon, authenticated;
grant all on public.external_brands to service_role;

alter table public.brand_products
  add column if not exists external_brand_id uuid references public.external_brands(id),
  add column if not exists external_url text,
  add column if not exists external_sizes jsonb not null default '[]'::jsonb,
  add column if not exists external_currency text,
  add column if not exists brand_logo_url text,
  add column if not exists external_synced_at timestamptz;
create unique index if not exists brand_products_external_url
  on public.brand_products (external_brand_id, external_url);

create or replace function public.sync_external_brand(
  p_creator_id uuid, p_creator_username text, p_creator_name text,
  p_origin text, p_name text, p_logo_url text, p_products jsonb, p_complete boolean
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  brand_id uuid;
  item jsonb;
begin
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'Cannot sync an empty catalog';
  end if;
  insert into public.external_brands (creator_id, site_origin, name, logo_url)
    values (p_creator_id, p_origin, p_name, p_logo_url)
    on conflict (creator_id, site_origin) do update set name = excluded.name, logo_url = excluded.logo_url
    returning id into brand_id;
  update public.brand_products set brand = p_name, brand_logo_url = p_logo_url
    where external_brand_id = brand_id and creator_id = p_creator_id;
  for item in select value from jsonb_array_elements(p_products) loop
    insert into public.brand_products (
      creator_id, creator_username, creator_name, brand, brand_logo_url, title, price,
      photo_url, external_brand_id, external_url, external_currency, external_sizes, external_synced_at, status
    ) values (
      p_creator_id, p_creator_username, p_creator_name, p_name, p_logo_url, item->>'title',
      (item->>'price')::numeric, item->>'photo_url', brand_id, item->>'external_url',
      item->>'currency', item->'sizes', now(), 'active'
    ) on conflict (external_brand_id, external_url) do update set
      creator_username = excluded.creator_username, creator_name = excluded.creator_name,
      brand = excluded.brand, brand_logo_url = excluded.brand_logo_url,
      title = excluded.title, price = excluded.price, photo_url = excluded.photo_url,
      external_currency = excluded.external_currency, external_sizes = excluded.external_sizes,
      external_synced_at = excluded.external_synced_at,
      status = 'active';
  end loop;
  if p_complete then
    update public.brand_products set status = 'archived'
      where external_brand_id = brand_id and creator_id = p_creator_id
      and not exists (select 1 from jsonb_array_elements(p_products) as entry(value)
        where entry.value->>'external_url' = brand_products.external_url);
  end if;
  return jsonb_array_length(p_products);
end;
$$;
revoke all on function public.sync_external_brand(uuid, text, text, text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_external_brand(uuid, text, text, text, text, text, jsonb, boolean) to service_role;
