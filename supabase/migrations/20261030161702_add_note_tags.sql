alter table public.documents add column if not exists tags text[] not null default '{}';
create index if not exists documents_tags_gin_idx on public.documents using gin (tags);
