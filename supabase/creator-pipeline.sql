-- Run once in the Supabase SQL Editor. Storage policies are separate from table policies.
create table if not exists public.brand_products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id),
  creator_username text not null default '',
  creator_name text not null default '',
  title text not null,
  brand text not null default '',
  category text not null default '',
  description text not null default '',
  materials text not null default '',
  condition text not null default 'New',
  segment text not null default 'store' check (segment = 'store'),
  status text not null default 'active' check (status in ('active', 'sold', 'archived')),
  price numeric(10,2) not null check (price >= 0.50),
  photo_url text not null default '',
  printful_product_id integer,
  printful_variant_id integer,
  printful_placement text not null default 'front',
  artwork_url text,
  mockup_urls jsonb not null default '[]'::jsonb,
  size text not null default '',
  color text not null default '',
  created_at timestamptz not null default now(),
  check (artwork_url is null or (printful_variant_id > 0 and printful_product_id > 0))
);
create index if not exists brand_products_creator on public.brand_products (creator_id, created_at desc);
create index if not exists brand_products_feed on public.brand_products (status, created_at desc);
alter table public.brand_products enable row level security;
drop policy if exists "Read active or own brand products" on public.brand_products;
create policy "Read active or own brand products" on public.brand_products
  for select using (status = 'active' or creator_id = auth.uid());
-- Writes use the authenticated server API, never an untrusted browser price/creator identity.
revoke all on public.brand_products from anon, authenticated;
grant select on public.brand_products to anon, authenticated;
grant all on public.brand_products to service_role;

create table if not exists public.creator_mockup_tasks (
  task_key text primary key,
  creator_id uuid not null references auth.users(id),
  product_id integer not null,
  variant_id integer not null,
  placement text not null,
  artwork_url text not null,
  size text not null default '',
  color text not null default '',
  status text not null default 'pending',
  mockup_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.creator_mockup_tasks enable row level security;
revoke all on public.creator_mockup_tasks from anon, authenticated;
grant all on public.creator_mockup_tasks to service_role;

create table if not exists public.creator_checkout_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  creator_customer_id uuid not null references auth.users(id),
  items jsonb not null,
  amount_total integer not null,
  currency text not null default 'usd',
  payment_status text not null default 'unpaid',
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'processing', 'draft', 'failed', 'not_required')),
  claim_until timestamptz,
  printful_order_id bigint,
  fulfillment_error text,
  created_at timestamptz not null default now()
);
alter table public.creator_checkout_orders enable row level security;
revoke all on public.creator_checkout_orders from anon, authenticated;
grant all on public.creator_checkout_orders to service_role;

create or replace function public.claim_creator_fulfillment(session_id text)
returns setof public.creator_checkout_orders
language sql security definer set search_path = public
as $$
  update public.creator_checkout_orders
  set fulfillment_status = 'processing', claim_until = now() + interval '2 minutes'
  where stripe_session_id = session_id
    and fulfillment_status in ('pending', 'failed', 'processing')
    and (claim_until is null or claim_until < now())
  returning *;
$$;
revoke all on function public.claim_creator_fulfillment(text) from public, anon, authenticated;
grant execute on function public.claim_creator_fulfillment(text) to service_role;
