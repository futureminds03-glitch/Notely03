revoke all on function private.prepare_legal_acceptance_record() from PUBLIC, anon, authenticated, service_role;
grant execute on function private.prepare_legal_acceptance_record() to authenticated, supabase_auth_admin;
