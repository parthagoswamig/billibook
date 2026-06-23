-- ============================================================
-- myBillBook Clone — Supabase SQL Migration
-- Run this in Supabase SQL Editor to add new fields to existing tables
-- ============================================================

-- Customers additions
alter table customers add column if not exists city text;
alter table customers add column if not exists pan text;
alter table customers add column if not exists opening_balance numeric default 0;

-- Products additions
alter table products add column if not exists description text;
alter table products add column if not exists mrp numeric default 0;
alter table products add column if not exists min_stock numeric default 0;
alter table products add column if not exists track_stock boolean default true;
alter table products add column if not exists is_service boolean default false;

-- Invoices additions
alter table invoices add column if not exists shipping_charges numeric default 0;
alter table invoices add column if not exists terms text;
alter table invoices add column if not exists is_draft boolean default false;
alter table invoices add column if not exists state_of_supply text;

-- Invoice items additions
alter table invoice_items add column if not exists unit text default 'Pcs';
alter table invoice_items add column if not exists discount numeric default 0;

