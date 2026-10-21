-- Only a store administrator can confirm or advance an order.
begin;
create or replace function public.set_store_order_status(p_receipt text,p_status text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare current_order public.orders%rowtype; previous text; changed jsonb;
begin
  if not public.is_store_admin() then raise exception 'Store administrator access is required.' using errcode='42501'; end if;
  if p_status is null or p_status not in ('Confirmed','Shipped','Delivered','Cancelled') then raise exception 'Invalid order status.'; end if;
  select * into current_order from public.orders where receipt=p_receipt for update;
  if not found then raise exception 'Order not found.'; end if;
  previous:=current_order.details->>'status';
  if previous=p_status then return current_order.details; end if;
  if not (
    (previous='Pending confirmation' and p_status in ('Confirmed','Cancelled')) or
    (previous='Confirmed' and p_status='Shipped') or
    (previous='Shipped' and p_status='Delivered')
  ) then raise exception 'This order cannot move from % to %.',previous,p_status; end if;
  changed:=jsonb_set(current_order.details,'{status}',to_jsonb(p_status))||jsonb_build_object('updatedAt',now());
  update public.orders set details=changed where request_id=current_order.request_id;
  return changed;
end;
$$;
revoke all on function public.set_store_order_status(text,text) from public,anon,authenticated;
grant execute on function public.set_store_order_status(text,text) to authenticated;
create or replace function public.delete_delivered_store_order(p_receipt text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare removed text;
begin
  if not public.is_store_admin() then raise exception 'Store administrator access is required.' using errcode='42501'; end if;
  delete from public.orders where receipt=p_receipt and details->>'status'='Delivered' returning receipt into removed;
  if removed is null then raise exception 'Only delivered orders can be deleted. Refresh your order list.'; end if;
  return jsonb_build_object('ok',true,'id',removed);
end;
$$;
revoke all on function public.delete_delivered_store_order(text) from public,anon,authenticated;
grant execute on function public.delete_delivered_store_order(text) to authenticated;
notify pgrst,'reload schema';
commit;
