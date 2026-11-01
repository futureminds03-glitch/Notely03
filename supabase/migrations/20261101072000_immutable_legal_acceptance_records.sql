-- Record verifiable, append-only acceptance of the published Notely legal documents.
-- The source commit below contains the exact Terms and Privacy Policy version shown at signup.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to supabase_auth_admin;

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_policy_version text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  acceptance_method text not null,
  acceptance_text text not null,
  source_commit_sha text not null,
  constraint legal_acceptances_user_versions_unique
    unique (user_id, terms_version, privacy_policy_version),
  constraint legal_acceptances_terms_version_check
    check (terms_version = '2026-11-01'),
  constraint legal_acceptances_privacy_version_check
    check (privacy_policy_version = '2026-11-01-r2'),
  constraint legal_acceptances_method_check
    check (acceptance_method in ('signup_checkbox', 'existing_user_checkbox')),
  constraint legal_acceptances_text_check
    check (acceptance_text = 'I agree to the Terms of Service and acknowledge the Privacy Policy.'),
  constraint legal_acceptances_source_commit_check
    check (source_commit_sha = '88bd72bfee4aca6e17651f7236b99ba303c0f050')
);

alter table public.legal_acceptances enable row level security;
revoke all on table public.legal_acceptances from public, anon, authenticated, service_role;
grant select, insert on table public.legal_acceptances to authenticated;

create policy legal_acceptances_select_own
on public.legal_acceptances
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy legal_acceptances_insert_own
on public.legal_acceptances
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function private.enforce_signup_legal_acceptance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'legal_terms_accepted', 'false') <> 'true'
     or new.raw_user_meta_data ->> 'legal_terms_version' is distinct from '2026-11-01'
     or new.raw_user_meta_data ->> 'privacy_policy_version' is distinct from '2026-11-01-r2' then
    raise exception using
      errcode = '23514',
      message = 'You must agree to the current Terms of Service and acknowledge the Privacy Policy before creating an account.';
  end if;
  return new;
end;
$$;

create or replace function private.prepare_legal_acceptance_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $
begin
  if new.terms_version is distinct from '2026-11-01'
     or new.privacy_policy_version is distinct from '2026-11-01-r2'
     or new.acceptance_method not in ('signup_checkbox', 'existing_user_checkbox') then
    raise exception using
      errcode = '23514',
      message = 'The legal acceptance record does not match the current document versions.';
  end if;

  new.accepted_at := statement_timestamp();
  new.acceptance_text := 'I agree to the Terms of Service and acknowledge the Privacy Policy.';
  new.source_commit_sha := '88bd72bfee4aca6e17651f7236b99ba303c0f050';
  return new;
end;
$;

create trigger legal_acceptances_normalize_before_insert
before insert on public.legal_acceptances
for each row execute function private.prepare_legal_acceptance_record();

create or replace function private.record_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.legal_acceptances (
    user_id, terms_version, privacy_policy_version, accepted_at,
    acceptance_method, acceptance_text, source_commit_sha
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'legal_terms_version',
    new.raw_user_meta_data ->> 'privacy_policy_version',
    statement_timestamp(),
    'signup_checkbox',
    'I agree to the Terms of Service and acknowledge the Privacy Policy.',
    '88bd72bfee4aca6e17651f7236b99ba303c0f050'
  );
  return new;
end;
$$;

revoke all on function private.enforce_signup_legal_acceptance() from public, anon, authenticated, service_role;
revoke all on function private.record_signup_legal_acceptance() from public, anon, authenticated, service_role;
grant execute on function private.enforce_signup_legal_acceptance() to supabase_auth_admin;
grant execute on function private.record_signup_legal_acceptance() to supabase_auth_admin;
grant usage on schema private to authenticated;
grant execute on function private.prepare_legal_acceptance_record() to authenticated, supabase_auth_admin;

create trigger notely_require_legal_acceptance
before insert on auth.users
for each row execute function private.enforce_signup_legal_acceptance();

create trigger notely_record_legal_acceptance
after insert on auth.users
for each row execute function private.record_signup_legal_acceptance();
