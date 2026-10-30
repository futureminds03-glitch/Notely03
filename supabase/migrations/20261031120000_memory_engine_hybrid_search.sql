-- Notely memory engine: deterministic insights + optional vector embeddings.
-- Apply this migration before deploying the matching application commit.
alter table public.document_insights
  add column if not exists source_hash text,
  add column if not exists extracted_at timestamptz not null default now();

create unique index if not exists document_insights_document_id_uidx
  on public.document_insights (document_id);

create unique index if not exists document_embeddings_document_model_uidx
  on public.document_embeddings (document_id, model)
  where model is not null;

create index if not exists document_embeddings_embedding_hnsw_idx
  on public.document_embeddings using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function public.upsert_document_memory(
  p_document_id uuid, p_source_hash text, p_summary text,
  p_key_topics jsonb, p_entities jsonb, p_action_items jsonb,
  p_embedding vector(1536) default null,
  p_embedding_model text default null,
  p_clear_embedding boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.documents d
    where d.id = p_document_id and d.user_id = (select auth.uid()) and d.status = 'active'
  ) then
    raise exception 'Memory source not found' using errcode = '42501';
  end if;

  insert into public.document_insights (
    document_id, summary, key_topics, entities, action_items, source_hash, extracted_at
  ) values (
    p_document_id, p_summary, coalesce(p_key_topics, '[]'::jsonb),
    coalesce(p_entities, '[]'::jsonb), coalesce(p_action_items, '[]'::jsonb), p_source_hash, now()
  )
  on conflict (document_id) do update set
    summary = excluded.summary, key_topics = excluded.key_topics, entities = excluded.entities,
    action_items = excluded.action_items, source_hash = excluded.source_hash, extracted_at = excluded.extracted_at;

  if p_clear_embedding then
    delete from public.document_embeddings where document_id = p_document_id;
  end if;
  if p_embedding is not null then
    if p_embedding_model is null or length(p_embedding_model) > 120 then
      raise exception 'A valid embedding model is required';
    end if;
    insert into public.document_embeddings (document_id, embedding, model)
    values (p_document_id, p_embedding, p_embedding_model)
    on conflict (document_id, model) where model is not null
    do update set embedding = excluded.embedding, created_at = now();
  end if;
end;
$function$;

create or replace function public.search_my_memories_hybrid(
  p_search_text text,
  p_query_embedding vector(1536) default null,
  p_result_limit integer default 8,
  p_exclude_id uuid default null
)
returns table (
  id uuid, title text, body text, created_at timestamptz, updated_at timestamptz,
  tags text[], score real, key_topics jsonb, entities jsonb, action_items jsonb, match_reasons jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $function$
  with tokens as (
    select string_agg(word, ' | ') as query_text, array_agg(distinct word) as words
    from regexp_split_to_table(lower(coalesce(p_search_text, '')), '[^[:alnum:]_]+') as word
    where length(word) >= 2
  ),
  parsed as (
    select
      websearch_to_tsquery('simple', coalesce(p_search_text, ''))
      || case when tokens.query_text is null then ''::tsquery else to_tsquery('simple', tokens.query_text) end as query,
      coalesce(tokens.words, array[]::text[]) as words
    from tokens
  ),
  vector_candidates as (
    select de.document_id,
      greatest(0, 1 - (de.embedding <=> p_query_embedding))::real as similarity
    from public.document_embeddings de
    where p_query_embedding is not null
      and de.embedding is not null
      and de.model = 'text-embedding-3-small'
    order by de.embedding <=> p_query_embedding
    limit 50
  ),
  ranked as (
    select
      d.id, d.title, d.body, d.created_at, d.updated_at, d.tags,
      coalesce(i.key_topics, '[]'::jsonb) as key_topics,
      coalesce(i.entities, '[]'::jsonb) as entities,
      coalesce(i.action_items, '[]'::jsonb) as action_items,
      coalesce(ts_rank_cd(d.search_vector, parsed.query), 0)::real as text_score,
      coalesce(vc.similarity, 0)::real as vector_score,
      (coalesce(d.title, '') ilike '%' || left(coalesce(p_search_text, ''), 80) || '%') as title_match,
      exists (
        select 1 from unnest(parsed.words) as q(word)
        where lower(q.word) = any(array(select lower(t.tag_value) from unnest(coalesce(d.tags, '{}'::text[])) as t(tag_value)))
      ) as tag_match,
      exists (
        select 1 from unnest(parsed.words) as q(word)
        where coalesce(i.key_topics, '[]'::jsonb)::text ilike '%' || q.word || '%'
          or coalesce(i.entities, '[]'::jsonb)::text ilike '%' || q.word || '%'
      ) as insight_match,
      parsed.query
    from public.documents d
    cross join parsed
    left join public.document_insights i on i.document_id = d.id
    left join vector_candidates vc on vc.document_id = d.id
    where auth.uid() is not null and d.user_id = (select auth.uid()) and d.status = 'active'
      and (p_exclude_id is null or d.id <> p_exclude_id)
  )
  select
    ranked.id, ranked.title, ranked.body, ranked.created_at, ranked.updated_at, ranked.tags,
    (ranked.text_score * 0.62
      + case when ranked.title_match then 0.35 else 0 end
      + case when ranked.tag_match then 0.08 else 0 end
      + case when ranked.insight_match then 0.12 else 0 end
      + ranked.vector_score * 0.45)::real as score,
    ranked.key_topics, ranked.entities, ranked.action_items,
    to_jsonb(array_remove(array[
      case when ranked.title_match then 'title match'::text end,
      case when ranked.tag_match then 'tag match'::text end,
      case when ranked.insight_match then 'topic/entity match'::text end,
      case when ranked.text_score > 0 then 'text match'::text end,
      case when ranked.vector_score > 0 then 'semantic similarity'::text end
    ], null)) as match_reasons
  from ranked
  where numnode(ranked.query) > 0
    and (ranked.text_score > 0 or ranked.title_match or ranked.tag_match
      or ranked.insight_match or ranked.vector_score >= 0.55)
  order by score desc, ranked.updated_at desc
  limit greatest(1, least(coalesce(p_result_limit, 8), 20));
$function$;

revoke all on function public.upsert_document_memory(uuid, text, text, jsonb, jsonb, jsonb, vector, text, boolean) from public;
revoke all on function public.upsert_document_memory(uuid, text, text, jsonb, jsonb, jsonb, vector, text, boolean) from anon;
grant execute on function public.upsert_document_memory(uuid, text, text, jsonb, jsonb, jsonb, vector, text, boolean) to authenticated;
revoke all on function public.search_my_memories_hybrid(text, vector, integer, uuid) from public;
revoke all on function public.search_my_memories_hybrid(text, vector, integer, uuid) from anon;
grant execute on function public.search_my_memories_hybrid(text, vector, integer, uuid) to authenticated;
