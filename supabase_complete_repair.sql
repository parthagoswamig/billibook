-- ============================================================
-- myBillBook Clone — Database Schema Repair and Completeness Script
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- ------------------------------------------------------------

-- Customers additions
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(15, 2) DEFAULT 0.00;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS pan text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS migration_job_id uuid REFERENCES public.migration_jobs(id) ON DELETE SET NULL;

-- Products additions
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_stock boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS migration_job_id uuid REFERENCES public.migration_jobs(id) ON DELETE SET NULL;

-- Invoices additions
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS migration_job_id uuid REFERENCES public.migration_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shipping_charges numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;

-- Expenses additions
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS migration_job_id uuid REFERENCES public.migration_jobs(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 2. CREATE MISSING TABLES
-- ------------------------------------------------------------

-- Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  code text,
  address text,
  created_at timestamptz DEFAULT now()
);

-- Warehouse Stocks (mapping product stocks to warehouses)
CREATE TABLE IF NOT EXISTS public.warehouse_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  stock numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);

-- Stock Transfers
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  from_location text,
  to_location text,
  qty numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  from_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL
);

-- Add warehouse foreign key columns to invoices & stock_adjustments if they are missing
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.stock_adjustments ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. ENABLE RLS & CREATE POLICIES FOR NEW TABLES
-- ------------------------------------------------------------

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- Policies for Warehouses
DROP POLICY IF EXISTS "own warehouses select" ON public.warehouses;
DROP POLICY IF EXISTS "own warehouses insert" ON public.warehouses;
DROP POLICY IF EXISTS "own warehouses update" ON public.warehouses;
DROP POLICY IF EXISTS "own warehouses delete" ON public.warehouses;

CREATE POLICY "own warehouses select" ON public.warehouses FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own warehouses insert" ON public.warehouses FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
CREATE POLICY "own warehouses update" ON public.warehouses FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
CREATE POLICY "own warehouses delete" ON public.warehouses FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Policies for Warehouse Stocks
DROP POLICY IF EXISTS "own wh_stocks select" ON public.warehouse_stocks;
DROP POLICY IF EXISTS "own wh_stocks insert" ON public.warehouse_stocks;
DROP POLICY IF EXISTS "own wh_stocks update" ON public.warehouse_stocks;
DROP POLICY IF EXISTS "own wh_stocks delete" ON public.warehouse_stocks;

CREATE POLICY "own wh_stocks select" ON public.warehouse_stocks FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own wh_stocks insert" ON public.warehouse_stocks FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
CREATE POLICY "own wh_stocks update" ON public.warehouse_stocks FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
CREATE POLICY "own wh_stocks delete" ON public.warehouse_stocks FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- Policies for Stock Transfers
DROP POLICY IF EXISTS "own transfers select" ON public.stock_transfers;
DROP POLICY IF EXISTS "own transfers insert" ON public.stock_transfers;
DROP POLICY IF EXISTS "own transfers update" ON public.stock_transfers;
DROP POLICY IF EXISTS "own transfers delete" ON public.stock_transfers;

CREATE POLICY "own transfers select" ON public.stock_transfers FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own transfers insert" ON public.stock_transfers FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
CREATE POLICY "own transfers update" ON public.stock_transfers FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));
CREATE POLICY "own transfers delete" ON public.stock_transfers FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) and public.get_user_role(auth.uid()) in ('admin', 'accountant'));

-- ------------------------------------------------------------
-- 4. CONSTRAINTS AND INDEXES FOR NEW TABLES
-- ------------------------------------------------------------

-- Add Negative Stock Constraint to warehouse_stocks
ALTER TABLE public.warehouse_stocks DROP CONSTRAINT IF EXISTS chk_warehouse_stocks_stock_non_negative;
ALTER TABLE public.warehouse_stocks ADD CONSTRAINT chk_warehouse_stocks_stock_non_negative CHECK (stock >= 0);

-- Indexes for Warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_user_id ON public.warehouses (user_id);

-- Indexes for Warehouse Stocks
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_user_id ON public.warehouse_stocks (user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_warehouse_id ON public.warehouse_stocks (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_product_id ON public.warehouse_stocks (product_id);

-- Indexes for Stock Transfers
CREATE INDEX IF NOT EXISTS idx_stock_transfers_user_id ON public.stock_transfers (user_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_product_id ON public.stock_transfers (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_warehouse_id ON public.stock_transfers (from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_warehouse_id ON public.stock_transfers (to_warehouse_id);

-- ------------------------------------------------------------
-- 5. RE-DEFINE TRIGGERS AND FUNCTIONS
-- ------------------------------------------------------------

-- Trigger: Prevent deletion of active warehouses that still contain stock
CREATE OR REPLACE FUNCTION public.prevent_active_warehouse_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.warehouse_stocks 
    WHERE warehouse_id = OLD.id AND stock > 0
  ) THEN
    RAISE EXCEPTION 'Cannot delete warehouse. It still contains stock. Please transfer or reconcile stock first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_active_warehouse_deletion ON public.warehouses;
CREATE TRIGGER trg_prevent_active_warehouse_deletion
BEFORE DELETE ON public.warehouses
FOR EACH ROW EXECUTE FUNCTION public.prevent_active_warehouse_deletion();

-- Trigger: Validate stock transfers (checking quantity and source warehouse stock level)
CREATE OR REPLACE FUNCTION public.validate_stock_transfer()
RETURNS TRIGGER AS $$
DECLARE
  source_stock NUMERIC := 0;
  prod_name TEXT;
  prod_track_stock BOOLEAN;
  prod_is_service BOOLEAN;
BEGIN
  SELECT name, track_stock, is_service INTO prod_name, prod_track_stock, prod_is_service
  FROM public.products WHERE id = NEW.product_id;

  IF prod_is_service IS TRUE OR prod_track_stock IS FALSE THEN
    RETURN NEW;
  END IF;

  IF NEW.qty <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than zero.';
  END IF;

  IF NEW.from_warehouse_id IS NOT NULL THEN
    -- Check stock level in the source warehouse
    SELECT COALESCE(stock, 0) INTO source_stock
    FROM public.warehouse_stocks
    WHERE warehouse_id = NEW.from_warehouse_id AND product_id = NEW.product_id;

    IF TG_OP = 'UPDATE' THEN
      -- If updating, add back old qty temporarily for validation
      IF OLD.from_warehouse_id = NEW.from_warehouse_id THEN
        source_stock := source_stock + OLD.qty;
      END IF;
    END IF;

    IF source_stock < NEW.qty THEN
      RAISE EXCEPTION 'Insufficient stock in source warehouse for product %. Available: %, Requested: %', 
        prod_name, source_stock, NEW.qty;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_stock_transfer ON public.stock_transfers;
CREATE TRIGGER trg_validate_stock_transfer
BEFORE INSERT OR UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.validate_stock_transfer();

-- Trigger: Synchronize stock values on stock transfers
CREATE OR REPLACE FUNCTION public.sync_stock_transfer_stock()
RETURNS TRIGGER AS $$
DECLARE
  prod_track_stock BOOLEAN;
  prod_is_service BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT track_stock, is_service INTO prod_track_stock, prod_is_service
    FROM public.products WHERE id = NEW.product_id;
  ELSE
    SELECT track_stock, is_service INTO prod_track_stock, prod_is_service
    FROM public.products WHERE id = OLD.product_id;
  END IF;

  IF prod_is_service IS TRUE OR prod_track_stock IS FALSE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 1. Revert OLD transfer if UPDATE or DELETE
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.from_warehouse_id IS NOT NULL THEN
      INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
      VALUES (OLD.user_id, OLD.from_warehouse_id, OLD.product_id, OLD.qty)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
    END IF;
    IF OLD.to_warehouse_id IS NOT NULL THEN
      INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
      VALUES (OLD.user_id, OLD.to_warehouse_id, OLD.product_id, -OLD.qty)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
    END IF;
  END IF;

  -- 2. Apply NEW transfer if INSERT or UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.from_warehouse_id IS NOT NULL THEN
      INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
      VALUES (NEW.user_id, NEW.from_warehouse_id, NEW.product_id, -NEW.qty)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
    END IF;
    IF NEW.to_warehouse_id IS NOT NULL THEN
      INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
      VALUES (NEW.user_id, NEW.to_warehouse_id, NEW.product_id, NEW.qty)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_stock_transfer_stock ON public.stock_transfers;
CREATE TRIGGER trg_sync_stock_transfer_stock
AFTER INSERT OR UPDATE OR DELETE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_transfer_stock();

-- ------------------------------------------------------------
-- 6. RE-CREATE RPC FUNCTIONS
-- ------------------------------------------------------------

-- RPC: get_customer_outstanding
CREATE OR REPLACE FUNCTION public.get_customer_outstanding(customer_uuid uuid)
RETURNS numeric AS $$
DECLARE
  total_invoices numeric;
  total_payments numeric;
BEGIN
  SELECT coalesce(sum(total), 0) INTO total_invoices FROM public.invoices WHERE customer_id = customer_uuid;
  SELECT coalesce(sum(amount), 0) INTO total_payments FROM public.invoice_payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE customer_id = customer_uuid);
  RETURN total_invoices - total_payments;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: rollback_migration_job (Removes records from a specific migration batch)
CREATE OR REPLACE FUNCTION public.rollback_migration_job(job_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  job_status text;
BEGIN
  -- Check if job exists
  SELECT status INTO job_status FROM public.migration_jobs WHERE id = job_uuid;
  
  IF job_status IS NULL THEN
    RAISE EXCEPTION 'Migration job not found.';
  END IF;
  
  IF job_status = 'rolled_back' THEN
    RAISE EXCEPTION 'Migration job has already been rolled back.';
  END IF;
  
  -- Delete records. Triggers will handle stock reversals and GL deletions.
  DELETE FROM public.invoices WHERE migration_job_id = job_uuid;
  DELETE FROM public.expenses WHERE migration_job_id = job_uuid;
  DELETE FROM public.products WHERE migration_job_id = job_uuid;
  DELETE FROM public.customers WHERE migration_job_id = job_uuid;
  
  -- Update migration job status
  UPDATE public.migration_jobs
  SET status = 'rolled_back'
  WHERE id = job_uuid;
  
  RETURN jsonb_build_object('success', true, 'message', 'Migration job rolled back successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: create_invoice_with_items
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
  invoice_data jsonb,
  items_data jsonb[]
)
RETURNS jsonb as $$
DECLARE
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
  cust_credit_limit numeric;
  cust_outstanding numeric;
  wh_id uuid;
BEGIN
  -- Check credit limit
  IF (invoice_data->>'customer_id') IS NOT NULL THEN
    SELECT credit_limit INTO cust_credit_limit FROM public.customers WHERE id = (invoice_data->>'customer_id')::uuid;
    IF cust_credit_limit IS NOT NULL AND cust_credit_limit > 0 THEN
      SELECT public.get_customer_outstanding((invoice_data->>'customer_id')::uuid) INTO cust_outstanding;
      IF (cust_outstanding + (invoice_data->>'total')::numeric - COALESCE((invoice_data->>'paid')::numeric, 0)) > cust_credit_limit THEN
        RAISE EXCEPTION 'Credit limit exceeded! Max allowed: %, current outstanding: %, new invoice balance: %', cust_credit_limit, cust_outstanding, ((invoice_data->>'total')::numeric - COALESCE((invoice_data->>'paid')::numeric, 0));
      END IF;
    END IF;
  END IF;

  wh_id := (invoice_data->>'warehouse_id')::uuid;

  -- A. Insert Invoice Header
  INSERT INTO public.invoices (
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
  ) VALUES (
    (invoice_data->>'user_id')::uuid,
    invoice_data->>'invoice_no',
    invoice_data->>'type',
    COALESCE(invoice_data->>'document_kind', 'sale_invoice'),
    (invoice_data->>'customer_id')::uuid,
    (invoice_data->>'date')::date,
    (invoice_data->>'due_date')::date,
    COALESCE(invoice_data->>'status', 'unpaid'),
    (invoice_data->>'subtotal')::numeric,
    (invoice_data->>'gst_amount')::numeric,
    COALESCE((invoice_data->>'discount')::numeric, 0),
    COALESCE((invoice_data->>'round_off')::numeric, 0),
    COALESCE((invoice_data->>'shipping_charges')::numeric, 0),
    invoice_data->>'state_of_supply',
    (invoice_data->>'total')::numeric,
    COALESCE((invoice_data->>'paid')::numeric, 0),
    COALESCE((invoice_data->>'balance')::numeric, (invoice_data->>'total')::numeric),
    invoice_data->>'notes',
    (invoice_data->>'reference_invoice_id')::uuid,
    invoice_data->>'last_payment_mode',
    CASE WHEN invoice_data->>'last_payment_at' IS NOT NULL THEN (invoice_data->>'last_payment_at')::timestamptz ELSE NULL END,
    wh_id
  )
  RETURNING id INTO inserted_invoice_id;

  -- B. Insert Invoice Items (which fires trg_sync_invoice_item_stock trigger automatically)
  FOREACH item_val IN ARRAY items_data
  LOOP
    prod_id := (item_val->>'product_id')::uuid;
    qty_val := (item_val->>'qty')::numeric;
    price_val := (item_val->>'price')::numeric;
    gst_val := COALESCE((item_val->>'gst')::integer, 0);
    amt_val := COALESCE((item_val->>'amount')::numeric, qty_val * price_val);
    disc_val := COALESCE((item_val->>'discount')::numeric, 0);
    unit_val := COALESCE(item_val->>'unit', 'Pcs');
    hsn_val := item_val->>'hsn';
    name_val := item_val->>'name';

    INSERT INTO public.invoice_items (
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
    ) VALUES (
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
  END LOOP;

  -- Return the inserted invoice as jsonb
  SELECT * INTO inserted_inv FROM public.invoices WHERE id = inserted_invoice_id;
  RETURN to_jsonb(inserted_inv);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
