-- ============================================================
-- myBillBook Clone — Supabase Payments Module Production Fixes
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- Ensure get_tenant_id function exists (if not created by rbac migration)
CREATE OR REPLACE FUNCTION public.get_tenant_id(user_uuid uuid)
RETURNS uuid AS $$
DECLARE
  tenant_uuid uuid;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = user_uuid;
  SELECT owner_id INTO tenant_uuid 
  FROM public.team_invites 
  WHERE lower(email) = lower(user_email) AND status = 'accepted'
  LIMIT 1;
  IF tenant_uuid IS NULL THEN
    tenant_uuid := user_uuid;
  END IF;
  RETURN tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure get_user_role function exists (if not created by rbac migration)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = user_uuid;
  RETURN COALESCE(user_role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,          -- 'create', 'update', 'delete', 'login', 'role_change', 'failed_access', 'user_create'
  entity_type text,             -- 'invoices', 'products', 'customers', 'user_roles', etc.
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Setup audit_logs policies
DROP POLICY IF EXISTS "admin view logs" ON public.audit_logs;
DROP POLICY IF EXISTS "allow insert logs" ON public.audit_logs;

CREATE POLICY "admin view logs" ON public.audit_logs FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "allow insert logs" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- Ensure journal_entries table exists
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_no text NOT NULL,
  date date NOT NULL,
  description text,
  reference_id uuid, -- invoice_id, payment_id, expense_id
  reference_type text, -- 'invoice', 'payment', 'expense', 'manual', 'payment_reversal'
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on journal_entries
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Setup journal_entries policies
DROP POLICY IF EXISTS "own journals select" ON public.journal_entries;
DROP POLICY IF EXISTS "own journals insert" ON public.journal_entries;
DROP POLICY IF EXISTS "own journals update" ON public.journal_entries;
DROP POLICY IF EXISTS "own journals delete" ON public.journal_entries;

CREATE POLICY "own journals select" ON public.journal_entries FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own journals insert" ON public.journal_entries FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own journals update" ON public.journal_entries FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own journals delete" ON public.journal_entries FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));


-- Ensure journal_items table exists
CREATE TABLE IF NOT EXISTS public.journal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_name text NOT NULL,
  debit numeric(15, 2) DEFAULT 0.00,
  credit numeric(15, 2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on journal_items
ALTER TABLE public.journal_items ENABLE ROW LEVEL SECURITY;

-- Setup journal_items policies
DROP POLICY IF EXISTS "own journal_items select" ON public.journal_items;
DROP POLICY IF EXISTS "own journal_items insert" ON public.journal_items;
DROP POLICY IF EXISTS "own journal_items update" ON public.journal_items;
DROP POLICY IF EXISTS "own journal_items delete" ON public.journal_items;

CREATE POLICY "own journal_items select" ON public.journal_items FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own journal_items insert" ON public.journal_items FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own journal_items update" ON public.journal_items FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own journal_items delete" ON public.journal_items FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));


-- Create payment_allocations table if it does not exist
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_id uuid REFERENCES public.invoice_payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount numeric(15, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Drop NOT NULL constraint on parent payment table to support allocations
ALTER TABLE public.invoice_payments ALTER COLUMN invoice_id DROP NOT NULL;

-- Enable RLS on payment_allocations
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Drop existing allocation policies if any
DROP POLICY IF EXISTS "own allocations select" ON public.payment_allocations;
DROP POLICY IF EXISTS "own allocations insert" ON public.payment_allocations;
DROP POLICY IF EXISTS "own allocations update" ON public.payment_allocations;
DROP POLICY IF EXISTS "own allocations delete" ON public.payment_allocations;

-- Create RLS Policies for payment_allocations
CREATE POLICY "own allocations select" ON public.payment_allocations FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own allocations insert" ON public.payment_allocations FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own allocations update" ON public.payment_allocations FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own allocations delete" ON public.payment_allocations FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

-- Clean up any existing negative/zero amounts (if any) to prevent constraint failure
UPDATE public.invoice_payments SET amount = 1 WHERE amount <= 0;
UPDATE public.payment_allocations SET amount = 1 WHERE amount <= 0;

-- 1. Add Positive Amount CHECK Constraints
ALTER TABLE public.invoice_payments DROP CONSTRAINT IF EXISTS chk_invoice_payments_amount_positive;
ALTER TABLE public.invoice_payments ADD CONSTRAINT chk_invoice_payments_amount_positive CHECK (amount > 0);

ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS chk_payment_allocations_amount_positive;
ALTER TABLE public.payment_allocations ADD CONSTRAINT chk_payment_allocations_amount_positive CHECK (amount > 0);


-- 2. Add Reversal status columns to invoice_payments
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS status text default 'active' CHECK (status in ('active', 'reversed'));
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS reversal_reason text;


-- 3. Trigger for Concurrency Locking on Allocations
CREATE OR REPLACE FUNCTION public.reconcile_invoice_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
  inv_total NUMERIC;
  inv_allocated NUMERIC;
  inv_balance NUMERIC;
  new_status TEXT;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Lock parent invoice row to serialize concurrent writes and prevent race conditions
    SELECT total INTO inv_total FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
    
    SELECT COALESCE(SUM(amount), 0) INTO inv_allocated FROM public.payment_allocations WHERE invoice_id = NEW.invoice_id;
    inv_balance := GREATEST(0, inv_total - inv_allocated);
    
    IF inv_balance = 0 THEN new_status := 'paid';
    ELSIF inv_allocated > 0 THEN new_status := 'partial';
    ELSE new_status := 'unpaid';
    END IF;
    
    UPDATE public.invoices SET paid = inv_allocated, balance = inv_balance, status = new_status WHERE id = NEW.invoice_id;
  END IF;
  
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    -- Lock parent invoice row
    SELECT total INTO inv_total FROM public.invoices WHERE id = OLD.invoice_id FOR UPDATE;
    
    SELECT COALESCE(SUM(amount), 0) INTO inv_allocated FROM public.payment_allocations WHERE invoice_id = OLD.invoice_id;
    inv_balance := GREATEST(0, inv_total - inv_allocated);
    
    IF inv_balance = 0 THEN new_status := 'paid';
    ELSIF inv_allocated > 0 THEN new_status := 'partial';
    ELSE new_status := 'unpaid';
    END IF;
    
    UPDATE public.invoices SET paid = inv_allocated, balance = inv_balance, status = new_status WHERE id = OLD.invoice_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reconcile_invoice_on_allocation ON public.payment_allocations;
CREATE TRIGGER trg_reconcile_invoice_on_allocation
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.reconcile_invoice_on_allocation();


-- 4. Trigger for Payment Allocation Safety Validation
CREATE OR REPLACE FUNCTION public.validate_payment_allocation()
RETURNS TRIGGER AS $$
DECLARE
  p_amount NUMERIC;
  p_allocated NUMERIC;
  inv_total NUMERIC;
  inv_allocated NUMERIC;
  p_status TEXT;
BEGIN
  -- Check if parent payment is reversed
  SELECT status, amount INTO p_status, p_amount 
  FROM public.invoice_payments WHERE id = NEW.payment_id;
  
  IF p_status = 'reversed' THEN
    RAISE EXCEPTION 'Cannot allocate to a reversed payment.';
  END IF;

  -- Calculate total allocated for this payment (excluding current row if it's an update)
  SELECT COALESCE(SUM(amount), 0) INTO p_allocated 
  FROM public.payment_allocations 
  WHERE payment_id = NEW.payment_id AND id != NEW.id;

  IF (p_allocated + NEW.amount) > p_amount + 0.01 THEN
    RAISE EXCEPTION 'Total allocated amount (%) exceeds the parent payment amount (%).', 
      (p_allocated + NEW.amount), p_amount;
  END IF;

  -- Lock invoice row and check remaining balance
  SELECT total INTO inv_total FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  
  SELECT COALESCE(SUM(amount), 0) INTO inv_allocated 
  FROM public.payment_allocations 
  WHERE invoice_id = NEW.invoice_id AND id != NEW.id;

  IF (inv_allocated + NEW.amount) > inv_total + 0.01 THEN
    RAISE EXCEPTION 'Allocation amount (%) exceeds remaining invoice balance (%).', 
      NEW.amount, (inv_total - inv_allocated);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_payment_allocation ON public.payment_allocations;
CREATE TRIGGER trg_validate_payment_allocation
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_allocation();


-- 5. Trigger for Cascading Payment Reversals
CREATE OR REPLACE FUNCTION public.handle_payment_reversal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'reversed' THEN
    -- Delete all allocations for this payment.
    -- This automatically fires trg_reconcile_invoice_on_allocation and restores invoice balances.
    DELETE FROM public.payment_allocations WHERE payment_id = NEW.id;
    
    NEW.reversed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_payment_reversal ON public.invoice_payments;
CREATE TRIGGER trg_handle_payment_reversal
BEFORE UPDATE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_reversal();


-- 6. Trigger for Double-Entry Journal Sync (Supplier support + Reversals)
CREATE OR REPLACE FUNCTION public.sync_payment_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  cust_name TEXT;
  cust_type TEXT;
  inv_no TEXT;
  ref_desc TEXT;
  ar_account TEXT;
  cash_bank_account TEXT;
BEGIN
  -- 1. If physical DELETE, remove all entries and exit
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type IN ('payment', 'payment_reversal');
    RETURN OLD;
  END IF;

  -- Fetch customer type and name
  SELECT name, type INTO cust_name, cust_type FROM public.customers WHERE id = NEW.customer_id;
  cust_name := COALESCE(cust_name, 'Walk-in Party');
  cust_type := COALESCE(cust_type, 'customer');

  -- Resolve account names
  IF cust_type = 'supplier' THEN
    ar_account := 'Accounts Payable (' || cust_name || ')';
  ELSE
    ar_account := 'Accounts Receivable (' || cust_name || ')';
  END IF;
  cash_bank_account := CASE WHEN COALESCE(NEW.payment_mode, 'Cash') = 'Cash' THEN 'Cash Book' ELSE 'Bank Account' END;

  -- 2. If status was changed to reversed
  IF OLD.status = 'active' AND NEW.status = 'reversed' THEN
    -- Ensure the original journal entry is NOT deleted.
    -- Delete any old reversal entry to remain idempotent
    DELETE FROM public.journal_entries WHERE reference_id = NEW.id AND reference_type = 'payment_reversal';

    -- Insert Reversal Journal Entry
    INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
    VALUES (
      NEW.user_id,
      'REV-PMT-' || substring(NEW.id::text, 1, 8),
      COALESCE(NEW.reversed_at, NOW())::date,
      'REVERSAL of payment PMT-' || substring(NEW.id::text, 1, 8) || ' (' || cust_name || ')' || COALESCE(' - Reason: ' || NEW.reversal_reason, ''),
      NEW.id,
      'payment_reversal'
    ) RETURNING id INTO je_id;

    -- Reversal items swap debits/credits of original:
    IF cust_type = 'supplier' THEN
      -- Supplier Reversal: Credit Accounts Payable, Debit Cash/Bank
      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_account, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, ar_account, 0.00, NEW.amount);
    ELSE
      -- Customer Reversal: Credit Cash/Bank, Debit Accounts Receivable
      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, ar_account, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_account, 0.00, NEW.amount);
    END IF;

  -- 3. If standard update of an active payment, recreate original
  ELSIF NEW.status = 'active' THEN
    DELETE FROM public.journal_entries WHERE reference_id = NEW.id AND reference_type = 'payment';

    IF NEW.invoice_id IS NOT NULL THEN
      SELECT invoice_no INTO inv_no FROM public.invoices WHERE id = NEW.invoice_id;
    END IF;

    IF inv_no IS NOT NULL THEN
      ref_desc := CASE WHEN cust_type = 'supplier' THEN 'Payment made for ' || inv_no || ' (' || cust_name || ')' ELSE 'Payment received for ' || inv_no || ' (' || cust_name || ')' END;
    ELSE
      ref_desc := CASE WHEN cust_type = 'supplier' THEN 'Bulk/Advance payment to ' || cust_name ELSE 'Bulk/Advance payment from ' || cust_name END;
    END IF;

    -- Insert Journal Entry Header
    INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
    VALUES (
      NEW.user_id,
      'PMT-' || substring(NEW.id::text, 1, 8),
      NEW.created_at::date,
      ref_desc,
      NEW.id,
      'payment'
    ) RETURNING id INTO je_id;

    -- Insert Journal Items
    IF cust_type = 'supplier' THEN
      -- Supplier Payment: Debit Accounts Payable, Credit Cash/Bank
      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, ar_account, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_account, 0.00, NEW.amount);
    ELSE
      -- Customer Receipt: Debit Cash/Bank, Credit Accounts Receivable
      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_account, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, ar_account, 0.00, NEW.amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_payment_journal ON public.invoice_payments;
CREATE TRIGGER trg_sync_payment_journal
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_journal();
