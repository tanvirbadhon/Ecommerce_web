-- Add editable product codes and recoverable Trash. Existing records and orders are retained.
begin;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists deleted boolean not null default false;
update public.products set sku='KTM-'||id::text where sku is null or trim(sku)='';

create or replace function public.prepare_store_product()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.sku := upper(trim(coalesce(new.sku,'')));
  if new.sku='' then new.sku:='KTM-'||new.id::text; end if;
  if new.sku !~ '^[A-Z0-9_-]{1,40}$' then
    raise exception 'Product ID must use 1–40 letters, numbers, hyphens or underscores.';
  end if;
  if new.deleted then new.active:=false; end if;
  return new;
end;
$$;
revoke all on function public.prepare_store_product() from public,anon,authenticated;
drop trigger if exists prepare_store_product on public.products;
create trigger prepare_store_product before insert or update on public.products
  for each row execute function public.prepare_store_product();
alter table public.products alter column sku set not null;
create unique index if not exists store_products_unique_sku on public.products(lower(sku));
notify pgrst,'reload schema';
commit;
