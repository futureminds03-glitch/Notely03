-- Allow an authenticated user to delete only their own Supabase Auth account.
-- The Auth foreign keys cascade deletion through notes, sources, versions and derived memory rows.
create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
  requesting_user_id uuid;
begin
  requesting_user_id := auth.uid();
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  delete from auth.users where id = requesting_user_id;
  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception 'Account could not be deleted' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

-- Functions default to EXECUTE for PUBLIC; explicitly narrow this capability.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
