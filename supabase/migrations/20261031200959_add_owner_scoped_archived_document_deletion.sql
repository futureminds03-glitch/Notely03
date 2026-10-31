-- Permanently remove one archived document and its now-unreferenced source records.
-- SECURITY INVOKER keeps the caller's RLS policies in force.
create or replace function public.delete_archived_document(p_document_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_source_ids uuid[];
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(array_agg(ds.source_id), array[]::uuid[])
    into linked_source_ids
    from public.document_sources ds
   where ds.document_id = p_document_id;

  delete from public.documents
   where id = p_document_id
     and user_id = auth.uid()
     and status = 'archived';

  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    return false;
  end if;

  delete from public.sources s
   where s.user_id = auth.uid()
     and s.id = any(linked_source_ids)
     and not exists (
       select 1
         from public.document_sources ds
        where ds.source_id = s.id
     );

  return true;
end;
$$;

revoke all on function public.delete_archived_document(uuid) from public, anon;
grant execute on function public.delete_archived_document(uuid) to authenticated;
