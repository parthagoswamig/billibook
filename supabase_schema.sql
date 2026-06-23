-- ============================================================
-- myBillBook Clone — Supabase SQL Setup (Complete & Idempotent)
-- Supabase Dashboard > SQL Editor > New Query > paste > Run
-- ============================================================

-- 1. CUSTOMERS / SUPPLIERS TABLE
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  address text,
  gstin text,
  balance numeric default 0,
  type text default 'customer',
  state text,
  city text,
  pan text,
  opening_balance numeric default 0,
  created_at timestamptz default now()
);

alter table customers add column if not exists state text;
alter table customers add column if not exists city text;
alter table customers add column if not exists pan text;
alter table customers add column if not exists opening_balance numeric default 0;

-- 2. PRODUCTS TABLE
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  unit text default 'Pcs',
  sale_price numeric default 0,
  purchase_price numeric default 0,
  gst integer default 18,
  stock numeric default 0,
  hsn text,
  description text,
  mrp numeric default 0,
  min_stock numeric default 0,
  track_stock boolean default true,
  is_service boolean default false,
  created_at timestamptz default now()
);

alter table products add column if not exists description text;
alter table products add column if not exists mrp numeric default 0;
alter table products add column if not exists min_stock numeric default 0;
alter table products add column if not exists track_stock boolean default true;
alter table products add column if not exists is_service boolean default false;

-- 3. INVOICES TABLE
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_no text not null,
  type text not null,
  document_kind text default 'sale_invoice',
  customer_id uuid references customers(id) on delete set null,
  date date,
  due_date date,
  status text default 'unpaid',
  subtotal numeric default 0,
  gst_amount numeric default 0,
  total numeric default 0,
  paid numeric default 0,
  balance numeric default 0,
  last_payment_mode text,
  last_payment_at timestamptz,
  notes text,
  discount numeric default 0,
  round_off numeric default 0,
  shipping_charges numeric default 0,
  terms text,
  is_draft boolean default false,
  reference_invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz default now()
);

alter table invoices add column if not exists discount numeric default 0;
alter table invoices add column if not exists round_off numeric default 0;
alter table invoices add column if not exists reference_invoice_id uuid;

alter table invoices add column if not exists document_kind text;
alter table invoices add column if not exists last_payment_mode text;
alter table invoices add column if not exists last_payment_at timestamptz;
update invoices
set document_kind = case
  when type = 'purchase' then 'purchase_order'
  else 'sale_invoice'
end
where document_kind is null;

alter table invoices alter column document_kind set default 'sale_invoice';
drop index if exists invoices_user_type_invoice_no_key;
create unique index if not exists invoices_user_type_document_kind_invoice_no_key on invoices(user_id, type, document_kind, invoice_no);

-- 4. INVOICE ITEMS TABLE
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  name text not null,
  hsn text,
  qty numeric default 1,
  price numeric default 0,
  gst integer default 0,
  amount numeric default 0
);

alter table invoice_items add column if not exists hsn text;

-- 5. INVOICE PAYMENTS TABLE
create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric default 0 not null,
  payment_mode text default 'Cash',
  note text,
  created_at timestamptz default now()
);

-- 6. EXPENSES TABLE
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  description text,
  amount numeric default 0,
  date date,
  payment_mode text default 'Cash',
  created_at timestamptz default now()
);

-- 6. BUSINESS PROFILE TABLE
create table if not exists business_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  business_name text,
  owner_name text,
  phone text,
  email text,
  address text,
  gstin text,
  state text,
  logo_url text,
  bank_name text,
  account_no text,
  ifsc text,
  upi_id text,
  invoice_prefix text default 'INV',
  default_due_days int default 0,
  currency_symbol text default '₹',
  terms text,
  created_at timestamptz default now()
);

alter table business_profile add column if not exists terms text;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table customers enable row level security;
alter table products enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table expenses enable row level security;
alter table invoice_payments enable row level security;
alter table business_profile enable row level security;

-- Drop existing policies first to prevent "already exists" errors
drop policy if exists "own customers select" on customers;
drop policy if exists "own customers insert" on customers;
drop policy if exists "own customers update" on customers;
drop policy if exists "own customers delete" on customers;

drop policy if exists "own products select" on products;
drop policy if exists "own products insert" on products;
drop policy if exists "own products update" on products;
drop policy if exists "own products delete" on products;

drop policy if exists "own invoices select" on invoices;
drop policy if exists "own invoices insert" on invoices;
drop policy if exists "own invoices update" on invoices;
drop policy if exists "own invoices delete" on invoices;

drop policy if exists "own items select" on invoice_items;
drop policy if exists "own items insert" on invoice_items;
drop policy if exists "own items update" on invoice_items;
drop policy if exists "own items delete" on invoice_items;

drop policy if exists "own payments select" on invoice_payments;
drop policy if exists "own payments insert" on invoice_payments;
drop policy if exists "own payments update" on invoice_payments;
drop policy if exists "own payments delete" on invoice_payments;

drop policy if exists "own expenses select" on expenses;
drop policy if exists "own expenses insert" on expenses;
drop policy if exists "own expenses update" on expenses;
drop policy if exists "own expenses delete" on expenses;

drop policy if exists "own profile select" on business_profile;
drop policy if exists "own profile insert" on business_profile;
drop policy if exists "own profile update" on business_profile;
drop policy if exists "own profile delete" on business_profile;

-- Create Policies
create policy "own customers select" on customers for select using (auth.uid() = user_id);
create policy "own customers insert" on customers for insert with check (auth.uid() = user_id);
create policy "own customers update" on customers for update using (auth.uid() = user_id);
create policy "own customers delete" on customers for delete using (auth.uid() = user_id);

create policy "own products select" on products for select using (auth.uid() = user_id);
create policy "own products insert" on products for insert with check (auth.uid() = user_id);
create policy "own products update" on products for update using (auth.uid() = user_id);
create policy "own products delete" on products for delete using (auth.uid() = user_id);

create policy "own invoices select" on invoices for select using (auth.uid() = user_id);
create policy "own invoices insert" on invoices for insert with check (auth.uid() = user_id);
create policy "own invoices update" on invoices for update using (auth.uid() = user_id);
create policy "own invoices delete" on invoices for delete using (auth.uid() = user_id);

create policy "own items select" on invoice_items for select using (auth.uid() = user_id);
create policy "own items insert" on invoice_items for insert with check (auth.uid() = user_id);
create policy "own items update" on invoice_items for update using (auth.uid() = user_id);
create policy "own items delete" on invoice_items for delete using (auth.uid() = user_id);

create policy "own payments select" on invoice_payments for select using (auth.uid() = user_id);
create policy "own payments insert" on invoice_payments for insert with check (auth.uid() = user_id);
create policy "own payments update" on invoice_payments for update using (auth.uid() = user_id);
create policy "own payments delete" on invoice_payments for delete using (auth.uid() = user_id);

create policy "own expenses select" on expenses for select using (auth.uid() = user_id);
create policy "own expenses insert" on expenses for insert with check (auth.uid() = user_id);
create policy "own expenses update" on expenses for update using (auth.uid() = user_id);
create policy "own expenses delete" on expenses for delete using (auth.uid() = user_id);

create policy "own profile select" on business_profile for select using (auth.uid() = user_id);
create policy "own profile insert" on business_profile for insert with check (auth.uid() = user_id);
create policy "own profile update" on business_profile for update using (auth.uid() = user_id);
create policy "own profile delete" on business_profile for delete using (auth.uid() = user_id);

-- 7. USER ROLES TABLE
create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text default 'admin' check (role in ('admin', 'accountant', 'viewer')),
  created_at timestamptz default now()
);

-- 8. TEAM INVITES TABLE
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  role text default 'viewer' check (role in ('admin', 'accountant', 'viewer')),
  status text default 'pending',
  created_at timestamptz default now(),
  unique(owner_id, email)
);

alter table user_roles enable row level security;
alter table team_invites enable row level security;

-- Drop existing role / invite policies
drop policy if exists "own role select" on user_roles;
drop policy if exists "own role insert" on user_roles;
drop policy if exists "own role update" on user_roles;

drop policy if exists "own invites select" on team_invites;
drop policy if exists "own invites insert" on team_invites;
drop policy if exists "own invites update" on team_invites;
drop policy if exists "own invites delete" on team_invites;

create policy "own role select" on user_roles for select using (auth.uid() = user_id);
create policy "own role insert" on user_roles for insert with check (auth.uid() = user_id);
create policy "own role update" on user_roles for update using (auth.uid() = user_id);

create policy "own invites select" on team_invites for select using (auth.uid() = owner_id);
create policy "own invites insert" on team_invites for insert with check (auth.uid() = owner_id);
create policy "own invites update" on team_invites for update using (auth.uid() = owner_id);
create policy "own invites delete" on team_invites for delete using (auth.uid() = owner_id);

-- 9. PAYMENT REMINDERS TABLE
create table if not exists payment_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_id uuid references invoices(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  reminder_date date not null,
  reminder_type text default 'due_date',
  days_before integer,
  message text,
  status text default 'pending',
  sent_via text[] default array['whatsapp'],
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- 10. STOCK ALERTS TABLE
create table if not exists stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  threshold numeric default 10,
  alert_type text default 'low_stock',
  status text default 'active',
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- 11. RECURRING INVOICES TABLE
create table if not exists recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  base_invoice_id uuid references invoices(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  frequency text not null,
  interval integer default 1,
  next_invoice_date date,
  end_date date,
  max_invoices integer,
  invoice_count integer default 0,
  status text default 'active',
  paused_at timestamptz,
  last_invoice_date date,
  created_at timestamptz default now()
);

alter table payment_reminders enable row level security;
alter table stock_alerts enable row level security;
alter table recurring_invoices enable row level security;

-- Drop reminder / stock / recurring policies
drop policy if exists "own reminders select" on payment_reminders;
drop policy if exists "own reminders insert" on payment_reminders;
drop policy if exists "own reminders update" on payment_reminders;
drop policy if exists "own reminders delete" on payment_reminders;

drop policy if exists "own alerts select" on stock_alerts;
drop policy if exists "own alerts insert" on stock_alerts;
drop policy if exists "own alerts update" on stock_alerts;
drop policy if exists "own alerts delete" on stock_alerts;

drop policy if exists "own recurring select" on recurring_invoices;
drop policy if exists "own recurring insert" on recurring_invoices;
drop policy if exists "own recurring update" on recurring_invoices;
drop policy if exists "own recurring delete" on recurring_invoices;

create policy "own reminders select" on payment_reminders for select using (auth.uid() = user_id);
create policy "own reminders insert" on payment_reminders for insert with check (auth.uid() = user_id);
create policy "own reminders update" on payment_reminders for update using (auth.uid() = user_id);
create policy "own reminders delete" on payment_reminders for delete using (auth.uid() = user_id);

create policy "own alerts select" on stock_alerts for select using (auth.uid() = user_id);
create policy "own alerts insert" on stock_alerts for insert with check (auth.uid() = user_id);
create policy "own alerts update" on stock_alerts for update using (auth.uid() = user_id);
create policy "own alerts delete" on stock_alerts for delete using (auth.uid() = user_id);

create policy "own recurring select" on recurring_invoices for select using (auth.uid() = user_id);
create policy "own recurring insert" on recurring_invoices for insert with check (auth.uid() = user_id);
create policy "own recurring update" on recurring_invoices for update using (auth.uid() = user_id);
create policy "own recurring delete" on recurring_invoices for delete using (auth.uid() = user_id);

-- Auto-create admin role + business profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'admin')
  on conflict (user_id) do nothing;
  insert into public.business_profile (user_id, business_name, email)
  values (new.id, new.raw_user_meta_data->>'business_name', new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
