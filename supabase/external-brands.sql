-- Run after supabase/creator-pipeline.sql. All writes go through the authenticated API.
create table if not exists public.brand_domain_challenges (
  domain text not null,
  creator_id uuid not null references auth.users(id),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified')),
  created_at timestamptz not null default now(),
  primary key (domain, creator_id),
  check (domain = lower(domain) and domain !~ '[^a-z0-9.-]' and domain not like '%.')
);
-- Pending challenges do not reserve domains; the first successful proof claims it.
create table if not exists public.brand_domain_claims (
  domain text primary key,
  creator_id uuid not null references auth.users(id),
  status text not null default 'verified' check (status = 'verified'),
  verified_at timestamptz not null default now(),
  foreign key (domain, creator_id) references public.brand_domain_challenges(domain, creator_id)
);
alter table public.brand_domain_challenges enable row level security;
alter table public.brand_domain_claims enable row level security;
revoke all on public.brand_domain_challenges, public.brand_domain_claims from anon, authenticated;
grant all on public.brand_domain_challenges, public.brand_domain_claims to service_role;

create or replace function public.claim_brand_domain(p_domain text, p_creator_id uuid, p_token text)
returns void language plpgsql security invoker set search_path = public
as $$
begin
  perform 1 from public.brand_domain_challenges
    where domain = p_domain and creator_id = p_creator_id and token = p_token for update;
  if not found then
    raise exception 'Verification challenge does not match' using errcode = '42501';
  end if;
  insert into public.brand_domain_claims (domain, creator_id)
    values (p_domain, p_creator_id)
    on conflict (domain) do update set verified_at = now()
      where brand_domain_claims.creator_id = excluded.creator_id;
  if not found then
    raise exception 'Domain is already claimed' using errcode = '23505';
  end if;
  update public.brand_domain_challenges set status = 'verified'
    where domain = p_domain and creator_id = p_creator_id;
end;
$$;
revoke all on function public.claim_brand_domain(text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_brand_domain(text, uuid, text) to service_role;

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

alter table public.external_brands
  add column if not exists flat_shipping_cents integer not null default 0
    check (flat_shipping_cents between 0 and 10000000);

create or replace function public.set_external_brand_shipping(
  p_brand_id uuid, p_creator_id uuid, p_amount_cents integer
) returns public.external_brands
language plpgsql security invoker set search_path = public
as $$
declare
  brand public.external_brands;
begin
  if p_amount_cents is null or p_amount_cents < 0 or p_amount_cents > 10000000 then
    raise exception 'Invalid flat shipping amount' using errcode = '22023';
  end if;
  update public.external_brands b set flat_shipping_cents = p_amount_cents
    where b.id = p_brand_id and b.creator_id = p_creator_id
      and exists (select 1 from public.brand_domain_claims c
        where b.site_origin = 'https://' || c.domain
          and c.creator_id = p_creator_id and c.status = 'verified')
    returning b.* into brand;
  if not found then
    raise exception 'Verified brand not found' using errcode = '42501';
  end if;
  return brand;
end;
$$;
revoke all on function public.set_external_brand_shipping(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.set_external_brand_shipping(uuid, uuid, integer) to service_role;

alter table public.brand_products
  add column if not exists external_brand_id uuid references public.external_brands(id),
  add column if not exists external_url text,
  add column if not exists external_sizes jsonb not null default '[]'::jsonb,
  add column if not exists external_variants jsonb not null default '[]'::jsonb,
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
  perform 1 from public.brand_domain_claims
    where 'https://' || domain = p_origin and creator_id = p_creator_id and status = 'verified'
    for share;
  if not found then
    raise exception 'Verify ownership of this website domain before importing products' using errcode = '42501';
  end if;
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
    if substring(item->>'external_url' from '^https://([^/?#]+)') is distinct from
        substring(p_origin from '^https://([^/?#]+)$') then
      raise exception 'Product URL must belong to the verified domain' using errcode = '42501';
    end if;
    insert into public.brand_products (
      creator_id, creator_username, creator_name, brand, brand_logo_url, title, price,
      photo_url, external_brand_id, external_url, external_currency, external_sizes, external_variants, external_synced_at, status
    ) values (
      p_creator_id, p_creator_username, p_creator_name, p_name, p_logo_url, item->>'title',
      (item->>'price')::numeric, item->>'photo_url', brand_id, item->>'external_url',
      item->>'currency', item->'sizes', coalesce(item->'variants', '[]'::jsonb), now(), 'active'
    ) on conflict (external_brand_id, external_url) do update set
      creator_username = excluded.creator_username, creator_name = excluded.creator_name,
      brand = excluded.brand, brand_logo_url = excluded.brand_logo_url,
      title = excluded.title, price = excluded.price, photo_url = excluded.photo_url,
      external_currency = excluded.external_currency, external_sizes = excluded.external_sizes,
      external_variants = excluded.external_variants,
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

-- Previously imported catalogs must prove ownership before being republished.
update public.brand_products p set status = 'archived'
  where p.external_brand_id is not null and p.status = 'active'
    and not exists (
      select 1 from public.external_brands b join public.brand_domain_claims c
        on b.site_origin = 'https://' || c.domain and b.creator_id = c.creator_id
      where b.id = p.external_brand_id and p.creator_id = c.creator_id and c.status = 'verified'
    );

create or replace function public.require_external_product_domain()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if new.status = 'active' and (new.external_brand_id is not null or new.external_url is not null) then
    perform 1 from public.external_brands b join public.brand_domain_claims c
      on b.site_origin = 'https://' || c.domain and b.creator_id = c.creator_id
      where b.id = new.external_brand_id and c.creator_id = new.creator_id and c.status = 'verified'
        and substring(new.external_url from '^https://([^/?#]+)') = c.domain;
    if not found then
      raise exception 'Verify ownership before publishing external products' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists require_external_product_domain on public.brand_products;
create trigger require_external_product_domain before insert or update on public.brand_products
  for each row execute function public.require_external_product_domain();
revoke all on function public.require_external_product_domain() from public, anon, authenticated;
grant execute on function public.require_external_product_domain() to service_role;
