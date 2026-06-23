-- ============================================================
-- myBillBook Clone — Supabase Inventory Expansion Migration
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Create Stock Adjustments Table
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  qty numeric not null,
  reason text,
  created_at timestamptz default now()
);

-- Enable RLS on stock_adjustments
alter table public.stock_adjustments enable row level security;

-- 2. Create Stock Transfers Table
create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  from_location text not null,
  to_location text not null,
  qty numeric not null,
  created_at timestamptz default now()
);

-- Enable RLS on stock_transfers
alter table public.stock_transfers enable row level security;

-- 3. Define RLS Policies
drop policy if exists "own adjustments select" on public.stock_adjustments;
drop policy if exists "own adjustments insert" on public.stock_adjustments;
drop policy if exists "own adjustments update" on public.stock_adjustments;
drop policy if exists "own adjustments delete" on public.stock_adjustments;

create policy "own adjustments select" on public.stock_adjustments for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own adjustments insert" on public.stock_adjustments for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own adjustments update" on public.stock_adjustments for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own adjustments delete" on public.stock_adjustments for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

drop policy if exists "own transfers select" on public.stock_transfers;
drop policy if exists "own transfers insert" on public.stock_transfers;
drop policy if exists "own transfers update" on public.stock_transfers;
drop policy if exists "own transfers delete" on public.stock_transfers;

create policy "own transfers select" on public.stock_transfers for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own transfers insert" on public.stock_transfers for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own transfers update" on public.stock_transfers for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own transfers delete" on public.stock_transfers for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
