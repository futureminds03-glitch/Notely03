-- Tighten API-role table privileges so RLS is not the only security boundary.
-- RLS does not apply to TRUNCATE, so anon/authenticated must not receive it.
revoke all privileges on table
  public.documents,
  public.document_versions,
  public.sources,
  public.document_sources,
  public.document_insights,
  public.document_embeddings
from anon, authenticated;

-- Browser clients use authenticated CRUD; per-user RLS policies constrain rows.
grant select, insert, update, delete on table
  public.documents,
  public.document_versions,
  public.sources,
  public.document_sources,
  public.document_insights,
  public.document_embeddings
to authenticated;

-- MCP/OAuth tables remain service_role-only; no direct grants are added.