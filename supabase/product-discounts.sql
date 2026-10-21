-- Optional percentage discounts; prices are calculated again by checkout.
begin;
alter table public.products add column if not exists discount_percent integer not null default 0;
alter table public.products drop constraint if exists store_discount_range;
alter table public.products add constraint store_discount_range check (discount_percent between 0 and 99 and round(price*(100-discount_percent)/100,2)>0);
create or replace function public.place_store_order(
  p_request_id uuid,
  p_items jsonb,
  p_customer jsonb,
  p_shipping text,
  p_expected_total numeric
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  existing public.orders%rowtype;
  product public.products%rowtype;
  line jsonb;
  item_id bigint;
  quantity integer;
  seen text[] := '{}';
  chosen_color text;
  line_key text;
  unit_price numeric(12,2);
  subtotal numeric(12,2) := 0;
  shipping_price integer;
  shipping_label text;
  total numeric(12,2);
  phone text;
  email text;
  customer jsonb;
  items jsonb := '[]'::jsonb;
  receipt text;
  order_details jsonb;
begin
  if p_request_id is null then raise exception 'Invalid order request.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('order:'||p_request_id::text,0));
  select * into existing from public.orders where request_id=p_request_id;
  if found then return jsonb_build_object('id',existing.receipt,'total',existing.details->'total'); end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Your bag contains invalid items.'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Your bag is empty or too large.'; end if;
  if p_customer is null or jsonb_typeof(p_customer)<>'object' then raise exception 'Please provide delivery details.'; end if;
  if length(trim(coalesce(p_customer->>'name',''))) not between 1 and 120
    or length(trim(coalesce(p_customer->>'address',''))) not between 1 and 500
    or length(trim(coalesce(p_customer->>'city',''))) not between 1 and 100
    or length(coalesce(p_customer->>'notes',''))>1000
    or length(coalesce(p_customer->>'postalCode',''))>15
  then raise exception 'Check your name, address and city.'; end if;
  phone := regexp_replace(coalesce(p_customer->>'phone',''),'[\s-]','','g');
  if phone !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladesh mobile number.'; end if;
  -- Normalize phone variants so a +88 prefix cannot bypass the per-phone limit.
  phone := right(phone,11);
  email := trim(coalesce(p_customer->>'email',''));
  if length(email)>254 or (email<>'' and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Enter a valid email address.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phone:'||phone,0));
  if (select count(*) from public.orders where customer_phone=phone and created_at>now()-interval '10 minutes')>=3
    then raise exception 'Please wait before placing another order, or contact the store.'; end if;
  case p_shipping
    when 'dhaka' then shipping_price:=80; shipping_label:='Inside Dhaka';
    when 'nearby' then shipping_price:=110; shipping_label:='Savar, Keraniganj, Narayanganj, Gazipur';
    when 'outside' then shipping_price:=150; shipping_label:='Outside Dhaka';
    else raise exception 'Choose a delivery area.';
  end case;
  for line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(line)<>'object' or coalesce(line->>'id','')!~'^[0-9]{1,15}$'
      or coalesce(line->>'quantity','')!~'^[0-9]{1,2}$' then raise exception 'Invalid item or quantity.'; end if;
    item_id:=(line->>'id')::bigint;
    quantity:=(line->>'quantity')::integer;
    chosen_color:=coalesce(line->>'color','');
    line_key:=item_id::text||':'||chosen_color;
    if quantity not between 1 and 99 or line_key=any(seen) then raise exception 'Invalid quantity or duplicate item.'; end if;
    seen:=array_append(seen,line_key);
    select * into product from public.products where id=item_id and active for share;
    if not found then raise exception 'An item is no longer available. Please refresh your bag.'; end if;
    if (jsonb_array_length(product.colors)>0 and not(product.colors ? chosen_color)) or (jsonb_array_length(product.colors)=0 and chosen_color<>'') then raise exception 'Choose an available color for this product.'; end if;
    unit_price:=round(product.price*(100-product.discount_percent)/100,2);
    subtotal:=subtotal+unit_price*quantity;
    items:=items||jsonb_build_array(jsonb_build_object('id',product.id,'name',product.name,'price',unit_price,'quantity',quantity,'color',chosen_color));
  end loop;
  total:=subtotal+shipping_price;
  if p_expected_total is null or p_expected_total<>total then raise exception 'Prices changed. Refresh checkout and review your total.'; end if;
  customer:=jsonb_build_object('name',trim(p_customer->>'name'),'phone',phone,'email',email,'address',trim(p_customer->>'address'),'city',trim(p_customer->>'city'),'postalCode',coalesce(p_customer->>'postalCode',''),'notes',coalesce(p_customer->>'notes',''));
  receipt:='KTM-'||upper(replace(gen_random_uuid()::text,'-',''));
  order_details:=jsonb_build_object('id',receipt,'createdAt',now(),'status','Pending confirmation','payment','Cash on delivery','customer',customer,'items',items,'shipping',jsonb_build_object('label',shipping_label,'price',shipping_price),'subtotal',subtotal,'total',total);
  insert into public.orders(request_id,receipt,customer_phone,details) values(p_request_id,receipt,phone,order_details);
  return jsonb_build_object('id',receipt,'total',total);
end;
$$;
revoke all on function public.place_store_order(uuid,jsonb,jsonb,text,numeric) from public, anon, authenticated;
grant execute on function public.place_store_order(uuid,jsonb,jsonb,text,numeric) to anon, authenticated;


notify pgrst,'reload schema';
commit;

notify pgrst,'reload schema';
commit;
