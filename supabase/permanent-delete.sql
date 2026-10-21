-- Permanently remove only products already in Trash. Order records are preserved.
begin;
create or replace function public.delete_trashed_store_product(p_id bigint)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare removed_id bigint;
begin
  if not public.is_store_admin() then raise exception 'Store administrator access is required.' using errcode='42501'; end if;
  delete from public.products where id=p_id and deleted=true returning id into removed_id;
  if removed_id is null then raise exception 'Product not found in Trash. Refresh the product list.'; end if;
  return jsonb_build_object('id',removed_id,'ok',true);
end;
$$;
revoke all on function public.delete_trashed_store_product(bigint) from public,anon,authenticated;
grant execute on function public.delete_trashed_store_product(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
