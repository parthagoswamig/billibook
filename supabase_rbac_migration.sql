-- ============================================================
-- myBillBook Clone — Supabase Backend RBAC & RLS Migration
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Create Audit Logs Table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,          -- 'create', 'update', 'delete', 'login', 'role_change', 'failed_access', 'user_create'
  entity_type text,             -- 'invoices', 'products', 'customers', 'user_roles', etc.
  entity_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;

-- 2. Define Helper Functions
-- Return role of a specific user
create or replace function public.get_user_role(user_uuid uuid)
returns text as $$
declare
  user_role text;
begin
  select role into user_role from public.user_roles where user_id = user_uuid;
  return coalesce(user_role, 'viewer');
end;
$$ language plpgsql security definer;

-- Return tenant ID (owner's UUID) for a user
create or replace function public.get_tenant_id(user_uuid uuid)
returns uuid as $$
declare
  tenant_uuid uuid;
  user_email text;
begin
  -- Get user email from auth.users
  select email into user_email from auth.users where id = user_uuid;
  
  -- Find if there is an accepted team invite for this email
  select owner_id into tenant_uuid 
  from public.team_invites 
  where lower(email) = lower(user_email) and status = 'accepted'
  limit 1;
  
  -- Fallback to own UUID if not invited
  if tenant_uuid is null then
    tenant_uuid := user_uuid;
  end if;
  
  return tenant_uuid;
end;
$$ language plpgsql security definer;

-- 3. Trigger to log role changes automatically
create or replace function public.log_role_changes()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (
      auth.uid(), 
      'role_create', 
      'user_roles', 
      new.user_id, 
      jsonb_build_object('user_id', new.user_id, 'new_role', new.role)
    );
  elsif (TG_OP = 'UPDATE') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (
      auth.uid(), 
      'role_change', 
      'user_roles', 
      new.user_id, 
      jsonb_build_object('user_id', new.user_id, 'old_role', old.role, 'new_role', new.role)
    );
  elsif (TG_OP = 'DELETE') then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (
      auth.uid(), 
      'role_delete', 
      'user_roles', 
      old.user_id, 
      jsonb_build_object('user_id', old.user_id, 'old_role', old.role)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_role_change on public.user_roles;
create trigger on_role_change
  after insert or update or delete on public.user_roles
  for each row execute procedure public.log_role_changes();

-- 4. Update public.handle_new_user trigger to log signups
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'admin')
  on conflict (user_id) do nothing;
  insert into public.business_profile (user_id, business_name, email)
  values (new.id, new.raw_user_meta_data->>'business_name', new.email)
  on conflict (user_id) do nothing;
  
  -- Log user creation event
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    new.id, 
    'user_create', 
    'users', 
    new.id, 
    jsonb_build_object('email', new.email)
  );
  
  return new;
end;
$$ language plpgsql security definer;

-- 5. Drop existing policies to prevent conflict errors
drop policy if exists "own customers select" on public.customers;
drop policy if exists "own customers insert" on public.customers;
drop policy if exists "own customers update" on public.customers;
drop policy if exists "own customers delete" on public.customers;

drop policy if exists "own products select" on public.products;
drop policy if exists "own products insert" on public.products;
drop policy if exists "own products update" on public.products;
drop policy if exists "own products delete" on public.products;

drop policy if exists "own invoices select" on public.invoices;
drop policy if exists "own invoices insert" on public.invoices;
drop policy if exists "own invoices update" on public.invoices;
drop policy if exists "own invoices delete" on public.invoices;

drop policy if exists "own items select" on public.invoice_items;
drop policy if exists "own items insert" on public.invoice_items;
drop policy if exists "own items update" on public.invoice_items;
drop policy if exists "own items delete" on public.invoice_items;

drop policy if exists "own payments select" on public.invoice_payments;
drop policy if exists "own payments insert" on public.invoice_payments;
drop policy if exists "own payments update" on public.invoice_payments;
drop policy if exists "own payments delete" on public.invoice_payments;

drop policy if exists "own expenses select" on public.expenses;
drop policy if exists "own expenses insert" on public.expenses;
drop policy if exists "own expenses update" on public.expenses;
drop policy if exists "own expenses delete" on public.expenses;

drop policy if exists "own profile select" on public.business_profile;
drop policy if exists "own profile insert" on public.business_profile;
drop policy if exists "own profile update" on public.business_profile;
drop policy if exists "own profile delete" on public.business_profile;

drop policy if exists "own role select" on public.user_roles;
drop policy if exists "own role insert" on public.user_roles;
drop policy if exists "own role update" on public.user_roles;
drop policy if exists "own role delete" on public.user_roles;

drop policy if exists "own invites select" on public.team_invites;
drop policy if exists "own invites insert" on public.team_invites;
drop policy if exists "own invites update" on public.team_invites;
drop policy if exists "own invites delete" on public.team_invites;

drop policy if exists "own reminders select" on public.payment_reminders;
drop policy if exists "own reminders insert" on public.payment_reminders;
drop policy if exists "own reminders update" on public.payment_reminders;
drop policy if exists "own reminders delete" on public.payment_reminders;

drop policy if exists "own alerts select" on public.stock_alerts;
drop policy if exists "own alerts insert" on public.stock_alerts;
drop policy if exists "own alerts update" on public.stock_alerts;
drop policy if exists "own alerts delete" on public.stock_alerts;

drop policy if exists "own recurring select" on public.recurring_invoices;
drop policy if exists "own recurring insert" on public.recurring_invoices;
drop policy if exists "own recurring update" on public.recurring_invoices;
drop policy if exists "own recurring delete" on public.recurring_invoices;

drop policy if exists "admin view logs" on public.audit_logs;
drop policy if exists "allow insert logs" on public.audit_logs;

-- 6. Define Strict RLS Policies using public.get_tenant_id() and public.get_user_role()

-- Customers
create policy "own customers select" on public.customers for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own customers insert" on public.customers for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own customers update" on public.customers for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own customers delete" on public.customers for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Products
create policy "own products select" on public.products for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own products insert" on public.products for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own products update" on public.products for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own products delete" on public.products for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Invoices
create policy "own invoices select" on public.invoices for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own invoices insert" on public.invoices for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own invoices update" on public.invoices for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own invoices delete" on public.invoices for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Invoice Items
create policy "own items select" on public.invoice_items for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own items insert" on public.invoice_items for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own items update" on public.invoice_items for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own items delete" on public.invoice_items for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Invoice Payments
create policy "own payments select" on public.invoice_payments for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own payments insert" on public.invoice_payments for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own payments update" on public.invoice_payments for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own payments delete" on public.invoice_payments for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Expenses
create policy "own expenses select" on public.expenses for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own expenses insert" on public.expenses for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own expenses update" on public.expenses for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own expenses delete" on public.expenses for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Business Profile
create policy "own profile select" on public.business_profile for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own profile insert" on public.business_profile for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own profile update" on public.business_profile for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own profile delete" on public.business_profile for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Payment Reminders
create policy "own reminders select" on public.payment_reminders for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own reminders insert" on public.payment_reminders for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own reminders update" on public.payment_reminders for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own reminders delete" on public.payment_reminders for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Stock Alerts
create policy "own alerts select" on public.stock_alerts for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own alerts insert" on public.stock_alerts for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own alerts update" on public.stock_alerts for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own alerts delete" on public.stock_alerts for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Recurring Invoices
create policy "own recurring select" on public.recurring_invoices for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own recurring insert" on public.recurring_invoices for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own recurring update" on public.recurring_invoices for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own recurring delete" on public.recurring_invoices for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- User Roles
create policy "own role select" on public.user_roles for select
  using (user_id = auth.uid() or public.get_user_role(auth.uid()) = 'admin');
create policy "own role insert" on public.user_roles for insert
  with check (public.get_user_role(auth.uid()) = 'admin' or not exists (select 1 from public.user_roles where user_id = auth.uid()));
create policy "own role update" on public.user_roles for update
  using (public.get_user_role(auth.uid()) = 'admin');
create policy "own role delete" on public.user_roles for delete
  using (public.get_user_role(auth.uid()) = 'admin');

-- Team Invites
create policy "own invites select" on public.team_invites for select
  using (owner_id = public.get_tenant_id(auth.uid()));
create policy "own invites insert" on public.team_invites for insert
  with check (owner_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');
create policy "own invites update" on public.team_invites for update
  using (owner_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');
create policy "own invites delete" on public.team_invites for delete
  using (owner_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');

-- Audit Logs Policies
create policy "admin view logs" on public.audit_logs for select
  using (public.get_user_role(auth.uid()) = 'admin');
create policy "allow insert logs" on public.audit_logs for insert
  with check (auth.uid() = user_id);
