create or replace function public.mcp_search_memories(
  p_user_id uuid,
  p_search_text text,
  p_result_limit integer default 8,
  p_exclude_id uuid default null
) returns table(
  id uuid,
  title text,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  tags text[],
  score real,
  key_topics jsonb,
  entities jsonb,
  action_items jsonb,
  match_reasons jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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
  ranked as (
    select
      d.id, d.title, d.body, d.created_at, d.updated_at, d.tags,
      coalesce(i.key_topics, '[]'::jsonb) as key_topics,
      coalesce(i.entities, '[]'::jsonb) as entities,
      coalesce(i.action_items, '[]'::jsonb) as action_items,
      coalesce(ts_rank_cd(d.search_vector, parsed.query), 0)::real as text_score,
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
    where p_user_id is not null
      and d.user_id = p_user_id
      and d.status = 'active'
      and (p_exclude_id is null or d.id <> p_exclude_id)
  )
  select
    ranked.id, ranked.title, ranked.body, ranked.created_at, ranked.updated_at, ranked.tags,
    (ranked.text_score * 0.62
      + case when ranked.title_match then 0.35 else 0 end
      + case when ranked.tag_match then 0.08 else 0 end
      + case when ranked.insight_match then 0.12 else 0 end)::real as score,
    ranked.key_topics, ranked.entities, ranked.action_items,
    to_jsonb(array_remove(array[
      case when ranked.title_match then 'title match'::text end,
      case when ranked.tag_match then 'tag match'::text end,
      case when ranked.insight_match then 'topic/entity match'::text end,
      case when ranked.text_score > 0 then 'text match'::text end
    ], null)) as match_reasons
  from ranked
  where numnode(ranked.query) > 0
    and (ranked.text_score > 0 or ranked.title_match or ranked.tag_match or ranked.insight_match)
  order by score desc, ranked.updated_at desc
  limit greatest(1, least(coalesce(p_result_limit, 8), 20));
$$;

create or replace function public.mcp_create_parking_item_idempotent(
  p_user_id uuid,
  p_client_id text,
  p_body text,
  p_idempotency_key text,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.mcp_idempotency%rowtype;
  created public.documents%rowtype;
  note_title text;
begin
  if p_user_id is null or p_body is null or length(btrim(p_body)) < 1 or length(p_body) > 12000 then
    raise exception 'VALIDATION_ERROR';
  end if;

  insert into public.mcp_idempotency(user_id,client_id,tool_name,idempotency_key,request_hash)
  values(p_user_id,p_client_id,'capture_to_parking_lot',p_idempotency_key,p_request_hash)
  on conflict do nothing;

  select * into existing from public.mcp_idempotency
  where user_id=p_user_id and client_id=p_client_id and tool_name='capture_to_parking_lot' and idempotency_key=p_idempotency_key
  for update;

  if existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if existing.result_json is not null then return existing.result_json || jsonb_build_object('replay',true); end if;

  note_title := left(regexp_replace(split_part(btrim(p_body), E'\n', 1), '\s+', ' ', 'g'), 72);
  if note_title = '' then note_title := 'Parked thought'; end if;

  insert into public.documents(user_id,title,body,status,tags,provenance)
  values(p_user_id,note_title,btrim(p_body),'parking',array['Parking Lot']::text[],'user_created')
  returning * into created;

  update public.mcp_idempotency
  set result_json=jsonb_build_object('ok',true,'item',jsonb_build_object(
    'id',created.id,'title',created.title,'body',created.body,'status',created.status,'created_at',created.created_at
  ))
  where user_id=p_user_id and client_id=p_client_id and tool_name='capture_to_parking_lot' and idempotency_key=p_idempotency_key;

  return (select result_json from public.mcp_idempotency
    where user_id=p_user_id and client_id=p_client_id and tool_name='capture_to_parking_lot' and idempotency_key=p_idempotency_key);
end;
$$;

create or replace function public.mcp_delete_parking_item_idempotent(
  p_user_id uuid,
  p_client_id text,
  p_item_id uuid,
  p_idempotency_key text,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.mcp_idempotency%rowtype;
  current_item public.documents%rowtype;
begin
  insert into public.mcp_idempotency(user_id,client_id,tool_name,idempotency_key,request_hash)
  values(p_user_id,p_client_id,'delete_parking_item',p_idempotency_key,p_request_hash)
  on conflict do nothing;

  select * into existing from public.mcp_idempotency
  where user_id=p_user_id and client_id=p_client_id and tool_name='delete_parking_item' and idempotency_key=p_idempotency_key
  for update;

  if existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if existing.result_json is not null then return existing.result_json || jsonb_build_object('replay',true); end if;

  select * into current_item from public.documents
  where id=p_item_id and user_id=p_user_id and status='parking'
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  delete from public.documents where id=p_item_id and user_id=p_user_id and status='parking';

  update public.mcp_idempotency
  set result_json=jsonb_build_object('ok',true,'deleted',true,'id',p_item_id)
  where user_id=p_user_id and client_id=p_client_id and tool_name='delete_parking_item' and idempotency_key=p_idempotency_key;

  return (select result_json from public.mcp_idempotency
    where user_id=p_user_id and client_id=p_client_id and tool_name='delete_parking_item' and idempotency_key=p_idempotency_key);
end;
$$;

revoke all on function public.mcp_search_memories(uuid,text,integer,uuid) from public, anon, authenticated;
revoke all on function public.mcp_create_parking_item_idempotent(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.mcp_delete_parking_item_idempotent(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.mcp_search_memories(uuid,text,integer,uuid) to service_role;
grant execute on function public.mcp_create_parking_item_idempotent(uuid,text,text,text,text) to service_role;
grant execute on function public.mcp_delete_parking_item_idempotent(uuid,text,uuid,text,text) to service_role;


create or replace function public.mcp_restore_note_version(
  p_user_id uuid,
  p_client_id text,
  p_note_id uuid,
  p_version_number integer,
  p_expected_updated_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.mcp_idempotency%rowtype;
  current_note public.documents%rowtype;
  selected_version public.document_versions%rowtype;
  updated_note public.documents%rowtype;
  next_version integer;
begin
  if p_version_number < 1 then raise exception 'VALIDATION_ERROR'; end if;

  insert into public.mcp_idempotency(user_id,client_id,tool_name,idempotency_key,request_hash)
  values(p_user_id,p_client_id,'restore_note_version',p_idempotency_key,p_request_hash)
  on conflict do nothing;

  select * into existing from public.mcp_idempotency
  where user_id=p_user_id and client_id=p_client_id and tool_name='restore_note_version' and idempotency_key=p_idempotency_key
  for update;

  if existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if existing.result_json is not null then return existing.result_json || jsonb_build_object('replay',true); end if;

  select * into current_note from public.documents
  where id=p_note_id and user_id=p_user_id and status='active'
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current_note.updated_at <> p_expected_updated_at then raise exception 'CONFLICT'; end if;

  select * into selected_version from public.document_versions
  where document_id=p_note_id and version_number=p_version_number;
  if not found then raise exception 'NOT_FOUND'; end if;

  if current_note.title = selected_version.title and current_note.body = selected_version.body then
    update public.mcp_idempotency
    set result_json=jsonb_build_object('ok',true,'restored',false,'note',jsonb_build_object('id',current_note.id,'title',current_note.title,'updated_at',current_note.updated_at))
    where user_id=p_user_id and client_id=p_client_id and tool_name='restore_note_version' and idempotency_key=p_idempotency_key;
  else
    update public.documents set title=selected_version.title,body=selected_version.body
    where id=p_note_id and user_id=p_user_id returning * into updated_note;

    select coalesce(max(version_number),0)+1 into next_version
    from public.document_versions where document_id=p_note_id;

    insert into public.document_versions(document_id,version_number,title,body)
    values(p_note_id,next_version,updated_note.title,updated_note.body);

    update public.mcp_idempotency
    set result_json=jsonb_build_object('ok',true,'restored',true,'restored_from_version',p_version_number,'new_version_number',next_version,
      'note',jsonb_build_object('id',updated_note.id,'title',updated_note.title,'updated_at',updated_note.updated_at))
    where user_id=p_user_id and client_id=p_client_id and tool_name='restore_note_version' and idempotency_key=p_idempotency_key;
  end if;

  return (select result_json from public.mcp_idempotency
    where user_id=p_user_id and client_id=p_client_id and tool_name='restore_note_version' and idempotency_key=p_idempotency_key);
end;
$$;

revoke all on function public.mcp_restore_note_version(uuid,text,uuid,integer,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.mcp_restore_note_version(uuid,text,uuid,integer,timestamptz,text,text) to service_role;
