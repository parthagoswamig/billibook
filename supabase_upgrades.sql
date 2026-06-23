-- ============================================================
-- myBillBook Clone — Database Upgrades Migration Script
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. SERVICE PRODUCTS SUPPORT
-- ------------------------------------------------------------
alter table public.products add column if not exists is_service boolean default false;

-- ------------------------------------------------------------
-- 2. PARTY CREDIT LIMITS
-- ------------------------------------------------------------
alter table public.customers add column if not exists credit_limit numeric(15, 2) default 0.00;

-- ------------------------------------------------------------
-- 3. PAYMENT ALLOCATION ENGINE
-- ------------------------------------------------------------
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  payment_id uuid references public.invoice_payments(id) on delete cascade not null,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  amount numeric(15, 2) not null,
  created_at timestamptz default now()
);

-- Drop NOT NULL constraint on parent payment table to support allocations
alter table public.invoice_payments alter column invoice_id drop not null;

-- Enable RLS on payment_allocations
alter table public.payment_allocations enable row level security;

-- Drop existing allocation policies if any
drop policy if exists "own allocations select" on public.payment_allocations;
drop policy if exists "own allocations insert" on public.payment_allocations;
drop policy if exists "own allocations update" on public.payment_allocations;
drop policy if exists "own allocations delete" on public.payment_allocations;

-- Create RLS Policies for payment_allocations
create policy "own allocations select" on public.payment_allocations for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own allocations insert" on public.payment_allocations for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own allocations update" on public.payment_allocations for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own allocations delete" on public.payment_allocations for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Trigger to auto-reconcile invoice paid amount, balance, and status when allocations change
create or replace function public.reconcile_invoice_on_allocation()
returns trigger as $$
declare
  inv_total numeric;
  inv_allocated numeric;
  inv_balance numeric;
  new_status text;
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    select total into inv_total from public.invoices where id = new.invoice_id;
    select coalesce(sum(amount), 0) into inv_allocated from public.payment_allocations where invoice_id = new.invoice_id;
    inv_balance := greatest(0, inv_total - inv_allocated);
    if inv_balance = 0 then new_status := 'paid';
    elsif inv_allocated > 0 then new_status := 'partial';
    else new_status := 'unpaid';
    end if;
    update public.invoices set paid = inv_allocated, balance = inv_balance, status = new_status where id = new.invoice_id;
  end if;
  if (TG_OP = 'DELETE' or TG_OP = 'UPDATE') then
    select total into inv_total from public.invoices where id = old.invoice_id;
    select coalesce(sum(amount), 0) into inv_allocated from public.payment_allocations where invoice_id = old.invoice_id;
    inv_balance := greatest(0, inv_total - inv_allocated);
    if inv_balance = 0 then new_status := 'paid';
    elsif inv_allocated > 0 then new_status := 'partial';
    else new_status := 'unpaid';
    end if;
    update public.invoices set paid = inv_allocated, balance = inv_balance, status = new_status where id = old.invoice_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_reconcile_invoice_on_allocation on public.payment_allocations;
create trigger trg_reconcile_invoice_on_allocation
after insert or update or delete on public.payment_allocations
for each row execute procedure public.reconcile_invoice_on_allocation();

-- ------------------------------------------------------------
-- 4. MULTI-WAREHOUSE INVENTORY
-- ------------------------------------------------------------
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  code text,
  address text,
  created_at timestamptz default now()
);

-- Enable RLS on warehouses
alter table public.warehouses enable row level security;

-- Drop warehouse policies if any
drop policy if exists "own warehouses select" on public.warehouses;
drop policy if exists "own warehouses insert" on public.warehouses;
drop policy if exists "own warehouses update" on public.warehouses;
drop policy if exists "own warehouses delete" on public.warehouses;

create policy "own warehouses select" on public.warehouses for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own warehouses insert" on public.warehouses for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own warehouses update" on public.warehouses for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own warehouses delete" on public.warehouses for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Warehouse Stocks (mapping product stocks to warehouses)
create table if not exists public.warehouse_stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  warehouse_id uuid references public.warehouses(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  stock numeric default 0,
  created_at timestamptz default now(),
  unique (warehouse_id, product_id)
);

-- Enable RLS on warehouse_stocks
alter table public.warehouse_stocks enable row level security;

-- Drop warehouse_stocks policies if any
drop policy if exists "own wh_stocks select" on public.warehouse_stocks;
drop policy if exists "own wh_stocks insert" on public.warehouse_stocks;
drop policy if exists "own wh_stocks update" on public.warehouse_stocks;
drop policy if exists "own wh_stocks delete" on public.warehouse_stocks;

create policy "own wh_stocks select" on public.warehouse_stocks for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own wh_stocks insert" on public.warehouse_stocks for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own wh_stocks update" on public.warehouse_stocks for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own wh_stocks delete" on public.warehouse_stocks for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Add warehouse references to stock transfers, stock adjustments and invoices
alter table public.stock_transfers add column if not exists from_warehouse_id uuid references public.warehouses(id) on delete set null;
alter table public.stock_transfers add column if not exists to_warehouse_id uuid references public.warehouses(id) on delete set null;
alter table public.stock_adjustments add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;
alter table public.invoices add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

-- ------------------------------------------------------------
-- 5. DOUBLE ENTRY ACCOUNTING CORE
-- ------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_no text not null,
  date date not null,
  description text,
  reference_id uuid, -- invoice_id, payment_id, expense_id
  reference_type text, -- 'invoice', 'payment', 'expense', 'manual'
  created_at timestamptz default now()
);

create table if not exists public.journal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_id uuid references public.journal_entries(id) on delete cascade not null,
  account_name text not null,
  debit numeric(15, 2) default 0.00,
  credit numeric(15, 2) default 0.00,
  created_at timestamptz default now()
);

-- Enable RLS on accounting tables
alter table public.journal_entries enable row level security;
alter table public.journal_items enable row level security;

-- Drop policies
drop policy if exists "own journals select" on public.journal_entries;
drop policy if exists "own journals insert" on public.journal_entries;
drop policy if exists "own journals update" on public.journal_entries;
drop policy if exists "own journals delete" on public.journal_entries;

drop policy if exists "own journal_items select" on public.journal_items;
drop policy if exists "own journal_items insert" on public.journal_items;
drop policy if exists "own journal_items update" on public.journal_items;
drop policy if exists "own journal_items delete" on public.journal_items;

-- RLS policies
create policy "own journals select" on public.journal_entries for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own journals insert" on public.journal_entries for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own journals update" on public.journal_entries for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own journals delete" on public.journal_entries for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

create policy "own journal_items select" on public.journal_items for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own journal_items insert" on public.journal_items for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own journal_items update" on public.journal_items for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own journal_items delete" on public.journal_items for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- ------------------------------------------------------------
-- 6. SMART MIGRATION ROLLBACK
-- ------------------------------------------------------------
create table if not exists public.migration_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_software text not null,
  import_type text not null,
  file_name text not null,
  total_records integer default 0,
  imported_records integer default 0,
  failed_records integer default 0,
  status text default 'completed' check (status in ('completed', 'failed', 'rolled_back')),
  imported_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.migration_jobs enable row level security;

-- Drop policies
drop policy if exists "own migration select" on public.migration_jobs;
drop policy if exists "own migration insert" on public.migration_jobs;
drop policy if exists "own migration delete" on public.migration_jobs;

create policy "own migration select" on public.migration_jobs for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own migration insert" on public.migration_jobs for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
create policy "own migration delete" on public.migration_jobs for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Add tracking columns
alter table public.customers add column if not exists migration_job_id uuid references public.migration_jobs(id) on delete set null;
alter table public.products add column if not exists migration_job_id uuid references public.migration_jobs(id) on delete set null;
alter table public.invoices add column if not exists migration_job_id uuid references public.migration_jobs(id) on delete set null;
alter table public.expenses add column if not exists migration_job_id uuid references public.migration_jobs(id) on delete set null;

-- ------------------------------------------------------------
-- 7. TEAM PERMISSION MATRIX
-- ------------------------------------------------------------
create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists public.custom_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role_id uuid references public.custom_roles(id) on delete cascade not null,
  module_name text not null, -- 'invoices', 'products', 'customers', 'expenses', etc.
  can_read boolean default true,
  can_write boolean default false,
  can_delete boolean default false,
  created_at timestamptz default now(),
  unique (role_id, module_name)
);

-- Enable RLS
alter table public.custom_roles enable row level security;
alter table public.custom_permissions enable row level security;

-- Drop policies
drop policy if exists "own custom_roles select" on public.custom_roles;
drop policy if exists "own custom_roles insert" on public.custom_roles;
drop policy if exists "own custom_roles update" on public.custom_roles;
drop policy if exists "own custom_roles delete" on public.custom_roles;

drop policy if exists "own permissions select" on public.custom_permissions;
drop policy if exists "own permissions insert" on public.custom_permissions;
drop policy if exists "own permissions update" on public.custom_permissions;
drop policy if exists "own permissions delete" on public.custom_permissions;

-- RLS policies
create policy "own custom_roles select" on public.custom_roles for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own custom_roles insert" on public.custom_roles for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');
create policy "own custom_roles update" on public.custom_roles for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');
create policy "own custom_roles delete" on public.custom_roles for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');

create policy "own permissions select" on public.custom_permissions for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own permissions insert" on public.custom_permissions for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');
create policy "own permissions update" on public.custom_permissions for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');
create policy "own permissions delete" on public.custom_permissions for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) = 'admin');

-- Add custom_role_id reference to user_roles
alter table public.user_roles add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null;

-- ------------------------------------------------------------
-- 8. CUSTOM POSTGRES FUNCTIONS (RPC)
-- ------------------------------------------------------------

-- Helper: Calculate Outstanding Customer Balance
create or replace function public.get_customer_outstanding(customer_uuid uuid)
returns numeric as $$
declare
  total_invoices numeric;
  total_payments numeric;
begin
  select coalesce(sum(total), 0) into total_invoices from public.invoices where customer_id = customer_uuid;
  select coalesce(sum(amount), 0) into total_payments from public.invoice_payments where invoice_id in (select id from public.invoices where customer_id = customer_uuid);
  return total_invoices - total_payments;
end;
$$ language plpgsql security definer;

-- RPC: Atomic Invoice Creation and Stock/Balance updates
create or replace function public.create_invoice_with_items(
  invoice_data jsonb,
  items_data jsonb[]
)
returns jsonb as $$
declare
  inserted_invoice_id uuid;
  inserted_inv public.invoices;
  item_val jsonb;
  prod_id uuid;
  qty_val numeric;
  price_val numeric;
  gst_val integer;
  amt_val numeric;
  disc_val numeric;
  unit_val text;
  hsn_val text;
  name_val text;
  prod_stock numeric;
  prod_is_service boolean;
  stock_mode text;
  kind_mode text;
  cust_credit_limit numeric;
  cust_outstanding numeric;
  wh_id uuid;
begin
  -- Check credit limit
  if (invoice_data->>'customer_id') is not null then
    select credit_limit into cust_credit_limit from public.customers where id = (invoice_data->>'customer_id')::uuid;
    if cust_credit_limit is not null and cust_credit_limit > 0 then
      select public.get_customer_outstanding((invoice_data->>'customer_id')::uuid) into cust_outstanding;
      if (cust_outstanding + (invoice_data->>'total')::numeric - coalesce((invoice_data->>'paid')::numeric, 0)) > cust_credit_limit then
        raise exception 'Credit limit exceeded! Max allowed: %, current outstanding: %, new invoice balance: %', cust_credit_limit, cust_outstanding, ((invoice_data->>'total')::numeric - coalesce((invoice_data->>'paid')::numeric, 0));
      end if;
    end if;
  end if;

  wh_id := (invoice_data->>'warehouse_id')::uuid;

  -- 1. Insert Invoice Header
  insert into public.invoices (
    user_id,
    invoice_no,
    type,
    document_kind,
    customer_id,
    date,
    due_date,
    status,
    subtotal,
    gst_amount,
    discount,
    round_off,
    shipping_charges,
    state_of_supply,
    total,
    paid,
    balance,
    notes,
    reference_invoice_id,
    last_payment_mode,
    last_payment_at,
    warehouse_id
  ) values (
    (invoice_data->>'user_id')::uuid,
    invoice_data->>'invoice_no',
    invoice_data->>'type',
    coalesce(invoice_data->>'document_kind', 'sale_invoice'),
    (invoice_data->>'customer_id')::uuid,
    (invoice_data->>'date')::date,
    (invoice_data->>'due_date')::date,
    coalesce(invoice_data->>'status', 'unpaid'),
    (invoice_data->>'subtotal')::numeric,
    (invoice_data->>'gst_amount')::numeric,
    coalesce((invoice_data->>'discount')::numeric, 0),
    coalesce((invoice_data->>'round_off')::numeric, 0),
    coalesce((invoice_data->>'shipping_charges')::numeric, 0),
    invoice_data->>'state_of_supply',
    (invoice_data->>'total')::numeric,
    coalesce((invoice_data->>'paid')::numeric, 0),
    coalesce((invoice_data->>'balance')::numeric, (invoice_data->>'total')::numeric),
    invoice_data->>'notes',
    (invoice_data->>'reference_invoice_id')::uuid,
    invoice_data->>'last_payment_mode',
    case when invoice_data->>'last_payment_at' is not null then (invoice_data->>'last_payment_at')::timestamptz else null end,
    wh_id
  )
  returning id into inserted_invoice_id;

  -- 2. Insert Invoice Items & Adjust stock
  kind_mode := coalesce(invoice_data->>'document_kind', 'sale_invoice');
  
  if kind_mode in ('sale_invoice', 'delivery_challan', 'purchase_return', 'debit_note') then
    stock_mode := 'out';
  elsif kind_mode in ('credit_note', 'purchase_bill') then
    stock_mode := 'in';
  else
    stock_mode := null;
  end if;

  foreach item_val in array items_data
  loop
    prod_id := (item_val->>'product_id')::uuid;
    qty_val := (item_val->>'qty')::numeric;
    price_val := (item_val->>'price')::numeric;
    gst_val := coalesce((item_val->>'gst')::integer, 0);
    amt_val := coalesce((item_val->>'amount')::numeric, qty_val * price_val);
    disc_val := coalesce((item_val->>'discount')::numeric, 0);
    unit_val := coalesce(item_val->>'unit', 'Pcs');
    hsn_val := item_val->>'hsn';
    name_val := item_val->>'name';

    -- Insert item row
    insert into public.invoice_items (
      invoice_id,
      user_id,
      product_id,
      name,
      hsn,
      qty,
      price,
      gst,
      amount,
      unit,
      discount
    ) values (
      inserted_invoice_id,
      (invoice_data->>'user_id')::uuid,
      prod_id,
      name_val,
      hsn_val,
      qty_val,
      price_val,
      gst_val,
      amt_val,
      unit_val,
      disc_val
    );

    -- Adjust stock if product exists and is not service
    if prod_id is not null and stock_mode is not null then
      select stock, is_service into prod_stock, prod_is_service from public.products where id = prod_id;
      if prod_is_service is not true then
        if stock_mode = 'out' then
          update public.products set stock = greatest(0, stock - qty_val) where id = prod_id;
          if wh_id is not null then
            insert into public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
            values ((invoice_data->>'user_id')::uuid, wh_id, prod_id, -qty_val)
            on conflict (warehouse_id, product_id) do update
            set stock = public.warehouse_stocks.stock - qty_val;
          end if;
        elsif stock_mode = 'in' then
          update public.products set stock = stock + qty_val where id = prod_id;
          if wh_id is not null then
            insert into public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
            values ((invoice_data->>'user_id')::uuid, wh_id, prod_id, qty_val)
            on conflict (warehouse_id, product_id) do update
            set stock = public.warehouse_stocks.stock + qty_val;
          end if;
        end if;
      end if;
    end if;
  end loop;

  -- Return the inserted invoice as jsonb
  select * into inserted_inv from public.invoices where id = inserted_invoice_id;
  return to_jsonb(inserted_inv);
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 9. DOUBLE ENTRY ACCOUNTING JOURNAL TRIGGERS
-- ------------------------------------------------------------

-- Trigger Function for Invoice Journal Synchronization
create or replace function public.sync_invoice_journal()
returns trigger as $$
declare
  je_id uuid;
  cust_name text;
begin
  -- Delete old journal entries if any
  delete from public.journal_entries where reference_id = old.id and reference_type = 'invoice';
  
  if (TG_OP = 'DELETE') then
    return old;
  end if;

  -- Only process sale_invoice or purchase_bill
  if new.document_kind not in ('sale_invoice', 'purchase_bill') then
    return new;
  end if;

  select name into cust_name from public.customers where id = new.customer_id;
  if cust_name is null then
    cust_name := 'Walk-in Party';
  end if;

  -- Insert journal entry
  insert into public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  values (
    new.user_id,
    'JV-' || new.invoice_no,
    new.date,
    case when new.document_kind = 'sale_invoice' then 'Sales Invoice to ' || cust_name else 'Purchase Bill from ' || cust_name end,
    new.id,
    'invoice'
  ) returning id into je_id;

  if new.document_kind = 'sale_invoice' then
    -- Debit: Accounts Receivable (Customer)
    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, 'Accounts Receivable (' || cust_name || ')', new.total, 0.00);

    -- Credit: Sales Revenue
    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, 'Sales Revenue', 0.00, new.subtotal);

    -- Credit: GST Collected (if any)
    if new.gst_amount > 0 then
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'GST Output Tax', 0.00, new.gst_amount);
    end if;
  else -- purchase_bill
    -- Debit: Purchase Cost
    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, 'Purchases', new.subtotal, 0.00);

    -- Debit: GST Paid (if any)
    if new.gst_amount > 0 then
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'GST Input Tax', new.gst_amount, 0.00);
    end if;

    -- Credit: Accounts Payable (Supplier)
    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, 'Accounts Payable (' || cust_name || ')', 0.00, new.total);
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_invoice_journal on public.invoices;
create trigger trg_sync_invoice_journal
after insert or update or delete on public.invoices
for each row execute procedure public.sync_invoice_journal();

-- Trigger Function for Payment Journal Synchronization
create or replace function public.sync_payment_journal()
returns trigger as $$
declare
  je_id uuid;
  cust_name text;
  inv_no text;
  ref_desc text;
begin
  delete from public.journal_entries where reference_id = old.id and reference_type = 'payment';
  
  if (TG_OP = 'DELETE') then
    return old;
  end if;

  -- Try to get invoice number and customer name
  if new.invoice_id is not null then
    select i.invoice_no, c.name into inv_no, cust_name
    from public.invoices i
    left join public.customers c on i.customer_id = c.id
    where i.id = new.invoice_id;
  end if;

  if cust_name is null then
    cust_name := 'Walk-in Party';
  end if;
  
  if inv_no is not null then
    ref_desc := 'Payment received for ' || inv_no || ' (' || cust_name || ')';
  else
    ref_desc := 'Bulk payment from ' || cust_name;
  end if;

  insert into public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  values (
    new.user_id,
    'PMT-' || substring(new.id::text, 1, 8),
    new.created_at::date,
    ref_desc,
    new.id,
    'payment'
  ) returning id into je_id;

  -- Debit: Cash or Bank Account
  insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
  values (
    new.user_id,
    je_id,
    case when coalesce(new.payment_mode, 'Cash') = 'Cash' then 'Cash Book' else 'Bank Account' end,
    new.amount,
    0.00
  );

  -- Credit: Accounts Receivable
  insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
  values (new.user_id, je_id, 'Accounts Receivable (' || cust_name || ')', 0.00, new.amount);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_payment_journal on public.invoice_payments;
create trigger trg_sync_payment_journal
after insert or update or delete on public.invoice_payments
for each row execute procedure public.sync_payment_journal();

-- Trigger Function for Expense Journal Synchronization
create or replace function public.sync_expense_journal()
returns trigger as $$
declare
  je_id uuid;
begin
  delete from public.journal_entries where reference_id = old.id and reference_type = 'expense';
  
  if (TG_OP = 'DELETE') then
    return old;
  end if;

  insert into public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  values (
    new.user_id,
    'EXP-' || substring(new.id::text, 1, 8),
    new.date,
    'Expense: ' || coalesce(new.category, 'Other') || ' - ' || coalesce(new.description, ''),
    new.id,
    'expense'
  ) returning id into je_id;

  -- Debit: Expense Account
  insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
  values (new.user_id, je_id, coalesce(new.category, 'General Expense'), new.amount, 0.00);

  -- Credit: Cash or Bank Account
  insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
  values (
    new.user_id,
    je_id,
    case when coalesce(new.payment_mode, 'Cash') = 'Cash' then 'Cash Book' else 'Bank Account' end,
    0.00,
    new.amount
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_expense_journal on public.expenses;
create trigger trg_sync_expense_journal
after insert or update or delete on public.expenses
for each row execute procedure public.sync_expense_journal();

-- Helper: Custom dynamic permission checking function
create or replace function public.check_user_permission(user_uuid uuid, module_name_param text, action_param text)
returns boolean as $$
declare
  u_role text;
  cust_role_id uuid;
  has_perm boolean;
begin
  -- Get user role
  select role, custom_role_id into u_role, cust_role_id from public.user_roles where user_id = user_uuid;
  
  -- If admin, they have all permissions
  if u_role = 'admin' then
    return true;
  end if;

  -- If viewer, they can only read (never write or delete)
  if u_role = 'viewer' then
    if action_param = 'read' then
      return true;
    else
      return false;
    end if;
  end if;

  -- If there is a custom role assigned
  if cust_role_id is not null then
    select case 
      when action_param = 'read' then can_read
      when action_param = 'write' then can_write
      when action_param = 'delete' then can_delete
      else false
    end into has_perm
    from public.custom_permissions
    where role_id = cust_role_id and module_name = module_name_param;

    return coalesce(has_perm, false);
  end if;

  -- Default fallback for built-in role: accountant
  if u_role = 'accountant' then
    if action_param = 'read' then
      return true;
    elsif action_param = 'write' then
      if module_name_param in ('invoices', 'invoice_items', 'invoice_payments', 'expenses', 'products', 'customers', 'payment_allocations', 'warehouses', 'warehouse_stocks') then
        return true;
      else
        return false;
      end if;
    elsif action_param = 'delete' then
      return false;
    end if;
  end if;

  return false;
end;
$$ language plpgsql security definer;

-- Apply Dynamic RLS policies across core tables
-- Invoices
drop policy if exists "own invoices select" on public.invoices;
drop policy if exists "own invoices insert" on public.invoices;
drop policy if exists "own invoices update" on public.invoices;
drop policy if exists "own invoices delete" on public.invoices;

create policy "own invoices select" on public.invoices for select
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'invoices', 'read'));
create policy "own invoices insert" on public.invoices for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'invoices', 'write'));
create policy "own invoices update" on public.invoices for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'invoices', 'write'));
create policy "own invoices delete" on public.invoices for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'invoices', 'delete'));

-- Customers
drop policy if exists "own customers select" on public.customers;
drop policy if exists "own customers insert" on public.customers;
drop policy if exists "own customers update" on public.customers;
drop policy if exists "own customers delete" on public.customers;

create policy "own customers select" on public.customers for select
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'customers', 'read'));
create policy "own customers insert" on public.customers for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'customers', 'write'));
create policy "own customers update" on public.customers for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'customers', 'write'));
create policy "own customers delete" on public.customers for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'customers', 'delete'));

-- Products
drop policy if exists "own products select" on public.products;
drop policy if exists "own products insert" on public.products;
drop policy if exists "own products update" on public.products;
drop policy if exists "own products delete" on public.products;

create policy "own products select" on public.products for select
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'products', 'read'));
create policy "own products insert" on public.products for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'products', 'write'));
create policy "own products update" on public.products for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'products', 'write'));
create policy "own products delete" on public.products for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'products', 'delete'));

-- Expenses
drop policy if exists "own expenses select" on public.expenses;
drop policy if exists "own expenses insert" on public.expenses;
drop policy if exists "own expenses update" on public.expenses;
drop policy if exists "own expenses delete" on public.expenses;

create policy "own expenses select" on public.expenses for select
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'expenses', 'read'));
create policy "own expenses insert" on public.expenses for insert
  with check (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'expenses', 'write'));
create policy "own expenses update" on public.expenses for update
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'expenses', 'write'));
create policy "own expenses delete" on public.expenses for delete
  using (user_id = public.get_tenant_id(auth.uid()) and public.check_user_permission(auth.uid(), 'expenses', 'delete'));

-- RPC: Rollback Migration Job
create or replace function public.rollback_migration_job(job_uuid uuid)
returns jsonb as $$
declare
  job_row public.migration_jobs;
  deleted_customers integer := 0;
  deleted_products integer := 0;
  deleted_invoices integer := 0;
  deleted_expenses integer := 0;
begin
  -- Fetch the job
  select * into job_row from public.migration_jobs where id = job_uuid;
  if job_row is null then
    raise exception 'Migration job % not found', job_uuid;
  end if;

  if job_row.status = 'rolled_back' then
    raise exception 'Migration job % has already been rolled back', job_uuid;
  end if;

  -- Delete all imported invoices (and their cascade items) linked to the migration job
  delete from public.invoices where migration_job_id = job_uuid;
  get diagnostics deleted_invoices = row_count;

  -- Delete all imported customers/suppliers linked to the migration job
  delete from public.customers where migration_job_id = job_uuid;
  get diagnostics deleted_customers = row_count;

  -- Delete all imported products linked to the migration job
  delete from public.products where migration_job_id = job_uuid;
  get diagnostics deleted_products = row_count;

  -- Delete all imported expenses linked to the migration job
  delete from public.expenses where migration_job_id = job_uuid;
  get diagnostics deleted_expenses = row_count;

  -- Update job status to rolled_back
  update public.migration_jobs
  set status = 'rolled_back', imported_records = 0
  where id = job_uuid;

  return json_build_object(
    'success', true,
    'deleted_invoices', deleted_invoices,
    'deleted_customers', deleted_customers,
    'deleted_products', deleted_products,
    'deleted_expenses', deleted_expenses
  )::jsonb;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 9. PARTIES ACCOUNTING CORRECTNESS UPGRADES
-- ------------------------------------------------------------

-- Add customer_id to invoice_payments to support unallocated advance payments
alter table public.invoice_payments add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- Add opening_balance_type to customers table
alter table public.customers add column if not exists opening_balance_type text default 'Dr' check (opening_balance_type in ('Dr', 'Cr'));

-- Partial unique indexes to prevent duplicates per tenant for non-empty phone and gstin
drop index if exists public.idx_customers_user_phone_type_unique;
create unique index idx_customers_user_phone_type_unique on public.customers (user_id, phone, type) 
  where (phone is not null and phone != '');

drop index if exists public.idx_customers_user_gstin_type_unique;
create unique index idx_customers_user_gstin_type_unique on public.customers (user_id, gstin, type) 
  where (gstin is not null and gstin != '');

-- Trigger function to automatically create manual journal entries for customer/supplier opening balances
create or replace function public.sync_customer_opening_journal()
returns trigger as $$
declare
  je_id uuid;
  opp_account text;
  party_account text;
  is_dr boolean;
begin
  -- Delete existing journal entry for this customer opening balance
  delete from public.journal_entries where reference_id = old.id and reference_type = 'opening_balance';

  if (TG_OP = 'DELETE') then
    return old;
  end if;

  -- Only create if opening balance is positive
  if coalesce(new.opening_balance, 0) = 0 then
    return new;
  end if;

  -- Determine account name and entry particulars
  if new.type = 'customer' then
    party_account := 'Accounts Receivable (' || new.name || ')';
    opp_account := 'Opening Balance Equity';
    -- Customers normal balance is Debit
    if coalesce(new.opening_balance_type, 'Dr') = 'Dr' then
      is_dr := true;
    else
      is_dr := false;
    end if;
  else -- supplier
    party_account := 'Accounts Payable (' || new.name || ')';
    opp_account := 'Opening Balance Equity';
    -- Suppliers normal balance is Credit
    if coalesce(new.opening_balance_type, 'Cr') = 'Cr' then
      is_dr := false;
    else
      is_dr := true;
    end if;
  end if;

  -- Insert journal header
  insert into public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  values (
    new.user_id,
    'OPB-' || substring(new.id::text, 1, 8),
    new.created_at::date,
    'Opening Balance for ' || new.name,
    new.id,
    'opening_balance'
  ) returning id into je_id;

  -- Insert journal items
  if is_dr then
    -- Debit party account, Credit Opening Balance Equity
    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, party_account, new.opening_balance, 0.00);

    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, opp_account, 0.00, new.opening_balance);
  else
    -- Debit Opening Balance Equity, Credit party account
    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, opp_account, new.opening_balance, 0.00);

    insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
    values (new.user_id, je_id, party_account, 0.00, new.opening_balance);
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_customer_opening_journal on public.customers;
create trigger trg_sync_customer_opening_journal
after insert or update or delete on public.customers
for each row execute procedure public.sync_customer_opening_journal();

-- Replace sync_invoice_journal to support credit/debit notes and purchase returns
create or replace function public.sync_invoice_journal()
returns trigger as $$
declare
  je_id uuid;
  cust_name text;
begin
  -- Delete old journal entries if any
  delete from public.journal_entries where reference_id = old.id and reference_type = 'invoice';
  
  if (TG_OP = 'DELETE') then
    return old;
  end if;

  -- Only process valid document kinds
  if new.document_kind not in ('sale_invoice', 'purchase_bill', 'credit_note', 'debit_note', 'purchase_return') then
    return new;
  end if;

  select name into cust_name from public.customers where id = new.customer_id;
  if cust_name is null then
    cust_name := 'Walk-in Party';
  end if;

  -- Insert journal entry header
  insert into public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  values (
    new.user_id,
    'JV-' || new.invoice_no,
    new.date,
    case 
      when new.document_kind = 'sale_invoice' then 'Sales Invoice to ' || cust_name 
      when new.document_kind = 'credit_note' then 'Credit Note to ' || cust_name
      when new.document_kind = 'debit_note' then 'Debit Note to/from ' || cust_name
      when new.document_kind = 'purchase_return' then 'Purchase Return to ' || cust_name
      else 'Purchase Bill from ' || cust_name 
    end,
    new.id,
    'invoice'
  ) returning id into je_id;

  if new.type = 'sale' then
    if new.document_kind = 'credit_note' then
      -- Credit Note (reduces customer receivable)
      -- Debit: Sales Returns
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Sales Returns', new.subtotal, 0.00);

      -- Debit: GST Output Tax (reverses tax collected)
      if new.gst_amount > 0 then
        insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
        values (new.user_id, je_id, 'GST Output Tax', new.gst_amount, 0.00);
      end if;

      -- Credit: Accounts Receivable (Customer)
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Accounts Receivable (' || cust_name || ')', 0.00, new.total);
    else
      -- Sale Invoice or Debit Note (increases customer receivable)
      -- Debit: Accounts Receivable (Customer)
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Accounts Receivable (' || cust_name || ')', new.total, 0.00);

      -- Credit: Sales Revenue
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Sales Revenue', 0.00, new.subtotal);

      -- Credit: GST Output Tax (collected)
      if new.gst_amount > 0 then
        insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
        values (new.user_id, je_id, 'GST Output Tax', 0.00, new.gst_amount);
      end if;
    end if;
  else -- purchase side
    if new.document_kind in ('purchase_return', 'debit_note') then
      -- Purchase Return / Debit Note (reduces supplier payable)
      -- Debit: Accounts Payable (Supplier)
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Accounts Payable (' || cust_name || ')', new.total, 0.00);

      -- Credit: Purchase Returns
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Purchase Returns', 0.00, new.subtotal);

      -- Credit: GST Input Tax (reverses credit claimed)
      if new.gst_amount > 0 then
        insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
        values (new.user_id, je_id, 'GST Input Tax', 0.00, new.gst_amount);
      end if;
    else
      -- Purchase Bill (increases supplier payable)
      -- Debit: Purchase Cost
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Purchases', new.subtotal, 0.00);

      -- Debit: GST Input Tax (claimed)
      if new.gst_amount > 0 then
        insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
        values (new.user_id, je_id, 'GST Input Tax', new.gst_amount, 0.00);
      end if;

      -- Credit: Accounts Payable (Supplier)
      insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
      values (new.user_id, je_id, 'Accounts Payable (' || cust_name || ')', 0.00, new.total);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Replace sync_payment_journal function to support resolving customer name from customer_id (for advance payments)
create or replace function public.sync_payment_journal()
returns trigger as $$
declare
  je_id uuid;
  cust_name text;
  inv_no text;
  ref_desc text;
begin
  delete from public.journal_entries where reference_id = old.id and reference_type = 'payment';
  
  if (TG_OP = 'DELETE') then
    return old;
  end if;

  -- Try to get invoice number and customer name
  if new.invoice_id is not null then
    select i.invoice_no, c.name into inv_no, cust_name
    from public.invoices i
    left join public.customers c on i.customer_id = c.id
    where i.id = new.invoice_id;
  else
    -- Resolve name from customer_id (for advance payments)
    select name into cust_name from public.customers where id = new.customer_id;
  end if;

  if cust_name is null then
    cust_name := 'Walk-in Party';
  end if;
  
  if inv_no is not null then
    ref_desc := 'Payment received for ' || inv_no || ' (' || cust_name || ')';
  else
    ref_desc := 'Advance/Bulk payment from ' || cust_name;
  end if;

  insert into public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  values (
    new.user_id,
    'PMT-' || substring(new.id::text, 1, 8),
    new.created_at::date,
    ref_desc,
    new.id,
    'payment'
  ) returning id into je_id;

  -- Debit: Cash or Bank Account
  insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
  values (
    new.user_id,
    je_id,
    case when coalesce(new.payment_mode, 'Cash') = 'Cash' then 'Cash Book' else 'Bank Account' end,
    new.amount,
    0.00
  );

  -- Credit: Accounts Receivable
  insert into public.journal_items (user_id, entry_id, account_name, debit, credit)
  values (new.user_id, je_id, 'Accounts Receivable (' || cust_name || ')', 0.00, new.amount);

  return new;
end;
$$ language plpgsql security definer;

-- Unified Helper: Calculate Outstanding Party Balance (Customer/Supplier)
create or replace function public.get_party_outstanding(party_uuid uuid)
returns numeric as $$
declare
  party_rec public.customers;
  outstanding numeric := 0;
  total_invoices numeric := 0;
  total_payments numeric := 0;
begin
  select * into party_rec from public.customers where id = party_uuid;
  if party_rec is null then
    return 0;
  end if;

  -- 1. Start with opening balance
  if party_rec.type = 'customer' then
    if party_rec.opening_balance_type = 'Cr' then
      outstanding := -coalesce(party_rec.opening_balance, 0);
    else
      outstanding := coalesce(party_rec.opening_balance, 0);
    end if;
  else -- supplier
    if party_rec.opening_balance_type = 'Dr' then
      outstanding := -coalesce(party_rec.opening_balance, 0);
    else
      outstanding := coalesce(party_rec.opening_balance, 0);
    end if;
  end if;

  -- 2. Add/subtract invoices depending on document kind and party type
  if party_rec.type = 'customer' then
    -- Debits: sale_invoice, debit_note
    select coalesce(sum(total), 0) into total_invoices from public.invoices
    where customer_id = party_uuid and type = 'sale' and document_kind in ('sale_invoice', 'debit_note');
    outstanding := outstanding + total_invoices;

    -- Credits: credit_note
    select coalesce(sum(total), 0) into total_invoices from public.invoices
    where customer_id = party_uuid and type = 'sale' and document_kind = 'credit_note';
    outstanding := outstanding - total_invoices;

    -- Credits: payments
    select coalesce(sum(amount), 0) into total_payments from public.invoice_payments
    where customer_id = party_uuid;
    outstanding := outstanding - total_payments;
  else -- supplier
    -- Credits: purchase_bill, credit_note (received from supplier)
    select coalesce(sum(total), 0) into total_invoices from public.invoices
    where customer_id = party_uuid and type = 'purchase' and document_kind in ('purchase_bill', 'credit_note');
    outstanding := outstanding + total_invoices;

    -- Debits: purchase_return, debit_note (issued to supplier)
    select coalesce(sum(total), 0) into total_invoices from public.invoices
    where customer_id = party_uuid and type = 'purchase' and document_kind in ('purchase_return', 'debit_note');
    outstanding := outstanding - total_invoices;

    -- Debits: payments (to supplier)
    select coalesce(sum(amount), 0) into total_payments from public.invoice_payments
    where customer_id = party_uuid;
    outstanding := outstanding - total_payments;
  end if;

  return outstanding;
end;
$$ language plpgsql security definer;

-- Backward compatible check override for invoices
create or replace function public.get_customer_outstanding(customer_uuid uuid)
returns numeric as $$
begin
  return public.get_party_outstanding(customer_uuid);
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 10. PRODUCTS & CATALOG UPGRADES (SKU, BARCODES, CATEGORIES)
-- ------------------------------------------------------------

-- Create product_categories table
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

-- Enable RLS on product_categories
alter table public.product_categories enable row level security;

-- Drop policies if exist
drop policy if exists "own categories select" on public.product_categories;
drop policy if exists "own categories insert" on public.product_categories;
drop policy if exists "own categories delete" on public.product_categories;

-- Create policies
create policy "own categories select" on public.product_categories for select
  using (user_id = public.get_tenant_id(auth.uid()));
create policy "own categories insert" on public.product_categories for insert
  with check (user_id = public.get_tenant_id(auth.uid()));
create policy "own categories delete" on public.product_categories for delete
  using (user_id = public.get_tenant_id(auth.uid()));

-- Add tracking columns to products table
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;

-- Partial unique indexes to prevent duplicates per tenant for non-empty sku and barcode
drop index if exists public.idx_products_user_sku_unique;
create unique index idx_products_user_sku_unique on public.products (user_id, sku) 
  where (sku is not null and sku != '');

drop index if exists public.idx_products_user_barcode_unique;
create unique index idx_products_user_barcode_unique on public.products (user_id, barcode) 
  where (barcode is not null and barcode != '');

-- Trigger function to auto-generate random unique SKU (e.g. SKU-8A7B2C) if left blank
create or replace function public.set_default_product_sku()
returns trigger as $$
begin
  if new.sku is null or trim(new.sku) = '' then
    new.sku := 'SKU-' || upper(substring(gen_random_uuid()::text, 1, 8));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_default_product_sku on public.products;
create trigger trg_set_default_product_sku
before insert on public.products
for each row execute procedure public.set_default_product_sku();
