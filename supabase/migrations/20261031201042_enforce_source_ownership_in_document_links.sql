-- A document can only link to source content owned by the same authenticated user.
drop policy if exists doc_sources_owner_all on public.document_sources;

create policy doc_sources_owner_all
on public.document_sources
for all
to authenticated
using (
  exists (
    select 1
      from public.documents d
     where d.id = document_sources.document_id
       and d.user_id = (select auth.uid())
  )
  and exists (
    select 1
      from public.sources s
     where s.id = document_sources.source_id
       and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
      from public.documents d
     where d.id = document_sources.document_id
       and d.user_id = (select auth.uid())
  )
  and exists (
    select 1
      from public.sources s
     where s.id = document_sources.source_id
       and s.user_id = (select auth.uid())
  )
);
