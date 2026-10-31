-- Account deletion is handled by the authenticated delete-account Edge Function.
-- Remove the temporary SECURITY DEFINER RPC so no public elevated function remains.
drop function if exists public.delete_my_account();
