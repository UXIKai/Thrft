-- Run after listings-schema.sql and supabase/creator-pipeline.sql.
-- Order data is served only by the authenticated server API.
create or replace view public.creator_order_items as
select o.id as order_id, o.creator_customer_id as buyer_id, o.created_at,
  o.fulfillment_status, o.printful_order_id, o.tracking_number, o.tracking_url,
  o.shipments, item.value as item, item.ordinality as item_index,
  coalesce(item.value->>'creatorId', bp.creator_id::text, l.seller_id::text) as seller_id,
  coalesce(item.value->>'source',
    case when bp.id is not null or item.value->>'printfulVariantId' is not null then 'store'
      when l.id is not null then 'market' else 'unknown' end) as source
from public.creator_checkout_orders o
cross join lateral jsonb_array_elements(o.items) with ordinality as item(value, ordinality)
left join public.brand_products bp on bp.id::text = item.value->>'productId'
left join public.listings l on l.id::text = item.value->>'productId'
where o.payment_status = 'paid';

revoke all on public.creator_order_items from public, anon, authenticated;
grant select on public.creator_order_items to service_role;
create index if not exists creator_checkout_buyer_paid
  on public.creator_checkout_orders (creator_customer_id, created_at desc) where payment_status = 'paid';
