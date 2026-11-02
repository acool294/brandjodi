-- Clients insert messages without sender_side (they have no grant on it); the trigger sets it.
-- A default keeps generated types and inserts simple. It must not be 'system', which skips masking.
alter table public.messages alter column sender_side set default 'creator';
