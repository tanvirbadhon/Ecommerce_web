-- Authorize the confirmed Kiddo Toy Mart administrator, checking both UID and email.
do $$
begin
  if not exists (
    select 1 from auth.users
    where id = 'ada6b454-4e93-4765-b95f-104344b8cc57'::uuid
      and lower(email) = 'mdshawon545454@gmail.com'
      and email_confirmed_at is not null
  ) then
    raise exception 'The expected confirmed administrator account was not found.';
  end if;

  insert into private.store_admins (user_id)
  values ('ada6b454-4e93-4765-b95f-104344b8cc57'::uuid)
  on conflict (user_id) do nothing;
end;
$$;

select exists (
  select 1 from private.store_admins
  where user_id = 'ada6b454-4e93-4765-b95f-104344b8cc57'::uuid
) as administrator_enabled;
