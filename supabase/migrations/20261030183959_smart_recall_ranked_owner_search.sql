-- Ranked, owner-scoped recall over the existing generated search_vector.
-- The function is SECURITY INVOKER and additionally filters by auth.uid().
create or replace function public.search_my_memories(
  search_text text,
  result_limit integer default 8,
  exclude_id uuid default null
)
returns table (
  id uuid, title text, body text, created_at timestamptz,
  updated_at timestamptz, tags text[], score real
)
language sql stable security invoker
set search_path = public, pg_temp
as $function$
  with tokens as (
    select string_agg(word, ' | ') as query_text
    from regexp_split_to_table(lower(coalesce(search_text, '')), '[^[:alnum:]_]+') as word
    where length(word) >= 2
  ),
  parsed as (
    select websearch_to_tsquery('simple', coalesce(search_text, ''))
      || case when tokens.query_text is null then ''::tsquery
              else to_tsquery('simple', tokens.query_text) end as query
    from tokens
  )
  select d.id, d.title, d.body, d.created_at, d.updated_at, d.tags,
    (ts_rank_cd(d.search_vector, parsed.query)
      + case when d.title ilike '%' || left(search_text, 80) || '%' then 0.35 else 0 end
      + case when coalesce(d.tags, '{}'::text[]) && array(
          select word from regexp_split_to_table(lower(coalesce(search_text, '')), '[^[:alnum:]_]+') as word
          where length(word) >= 2
        ) then 0.08 else 0 end)::real as score
  from public.documents d
  cross join parsed
  where auth.uid() is not null
    and d.user_id = (select auth.uid())
    and d.status = 'active'
    and (exclude_id is null or d.id <> exclude_id)
    and numnode(parsed.query) > 0
    and (d.search_vector @@ parsed.query
      or coalesce(d.tags, '{}'::text[]) && array(
        select word from regexp_split_to_table(lower(coalesce(search_text, '')), '[^[:alnum:]_]+') as word
        where length(word) >= 2
      ))
  order by score desc, d.updated_at desc
  limit greatest(1, least(coalesce(result_limit, 8), 20));
$function$;

revoke all on function public.search_my_memories(text, integer, uuid) from public;
revoke all on function public.search_my_memories(text, integer, uuid) from anon;
grant execute on function public.search_my_memories(text, integer, uuid) to authenticated;
