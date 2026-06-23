-- ============================================================
-- myBillBook Clone — Supabase Accounting Module Upgrades
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Create Chart of Accounts Table
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, code),
  UNIQUE(user_id, name)
);

-- Enable RLS on Chart of Accounts
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own coa select" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "own coa insert" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "own coa update" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "own coa delete" ON public.chart_of_accounts;

CREATE POLICY "own coa select" ON public.chart_of_accounts FOR SELECT USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own coa insert" ON public.chart_of_accounts FOR INSERT WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "own coa update" ON public.chart_of_accounts FOR UPDATE USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "own coa delete" ON public.chart_of_accounts FOR DELETE USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');

-- 2. Define COA Seeding Function
CREATE OR REPLACE FUNCTION public.seed_tenant_coa(t_id uuid)
RETURNS void AS $$
BEGIN
  -- Assets (1000s)
  INSERT INTO public.chart_of_accounts (user_id, code, name, type, is_system)
  VALUES 
    (t_id, '1010', 'Cash Book', 'asset', true),
    (t_id, '1020', 'Bank Account', 'asset', true),
    (t_id, '1200', 'Accounts Receivable', 'asset', true),
    (t_id, '1300', 'Inventory Asset', 'asset', true),
    (t_id, '1410', 'CGST Input Tax', 'asset', true),
    (t_id, '1420', 'SGST Input Tax', 'asset', true),
    (t_id, '1430', 'IGST Input Tax', 'asset', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Liabilities (2000s)
  INSERT INTO public.chart_of_accounts (user_id, code, name, type, is_system)
  VALUES 
    (t_id, '2010', 'Accounts Payable', 'liability', true),
    (t_id, '2210', 'CGST Output Tax', 'liability', true),
    (t_id, '2220', 'SGST Output Tax', 'liability', true),
    (t_id, '2230', 'IGST Output Tax', 'liability', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Equity (3000s)
  INSERT INTO public.chart_of_accounts (user_id, code, name, type, is_system)
  VALUES 
    (t_id, '3010', 'Opening Balance Equity', 'equity', true),
    (t_id, '3020', 'Retained Earnings', 'equity', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Revenue (4000s)
  INSERT INTO public.chart_of_accounts (user_id, code, name, type, is_system)
  VALUES 
    (t_id, '4010', 'Sales Revenue', 'revenue', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Expenses (5000s)
  INSERT INTO public.chart_of_accounts (user_id, code, name, type, is_system)
  VALUES 
    (t_id, '5010', 'Purchases', 'expense', true),
    (t_id, '5020', 'Cost of Goods Sold', 'expense', true),
    (t_id, '5030', 'Loss on Damaged Goods', 'expense', true),
    (t_id, '5040', 'Loss of Stock (Theft/Loss)', 'expense', true),
    (t_id, '5050', 'Inventory Adjustment Expense', 'expense', true),
    (t_id, '5060', 'Inventory Surplus/Gain', 'revenue', true),
    (t_id, '5990', 'General Expense', 'expense', true)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to seed COA on new business profile creation
CREATE OR REPLACE FUNCTION public.trigger_seed_coa()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_tenant_coa(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_coa ON public.business_profile;
CREATE TRIGGER trg_seed_coa
AFTER INSERT ON public.business_profile
FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_coa();

-- Seed COA for all existing tenants
DO $$
DECLARE
  u_id uuid;
BEGIN
  FOR u_id IN SELECT DISTINCT user_id FROM public.business_profile LOOP
    PERFORM public.seed_tenant_coa(u_id);
  END LOOP;
END;
$$;
-- 2.5 Ensure stock_adjustments table exists
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  qty numeric NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own adjustments select" ON public.stock_adjustments;
DROP POLICY IF EXISTS "own adjustments insert" ON public.stock_adjustments;
DROP POLICY IF EXISTS "own adjustments update" ON public.stock_adjustments;
DROP POLICY IF EXISTS "own adjustments delete" ON public.stock_adjustments;

CREATE POLICY "own adjustments select" ON public.stock_adjustments FOR SELECT USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own adjustments insert" ON public.stock_adjustments FOR INSERT WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own adjustments update" ON public.stock_adjustments FOR UPDATE USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));
CREATE POLICY "own adjustments delete" ON public.stock_adjustments FOR DELETE USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

-- 3. Refactor journal_items schema
ALTER TABLE public.journal_items ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.journal_items ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_service boolean DEFAULT false;

-- Dynamic COA ID resolver function
CREATE OR REPLACE FUNCTION public.get_coa_id(u_id uuid, coa_name text)
RETURNS uuid AS $$
DECLARE
  coa_uuid uuid;
BEGIN
  SELECT id INTO coa_uuid FROM public.chart_of_accounts WHERE user_id = public.get_tenant_id(u_id) AND name = coa_name LIMIT 1;
  IF coa_uuid IS NULL THEN
    PERFORM public.seed_tenant_coa(public.get_tenant_id(u_id));
    SELECT id INTO coa_uuid FROM public.chart_of_accounts WHERE user_id = public.get_tenant_id(u_id) AND name = coa_name LIMIT 1;
  END IF;
  RETURN coa_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing journal_items to map free-text account_name to account_id and party_id
DO $$
DECLARE
  item_row record;
  coa_id uuid;
  p_id uuid;
  clean_name text;
BEGIN
  FOR item_row IN SELECT id, user_id, account_name FROM public.journal_items WHERE account_id IS NULL LOOP
    coa_id := NULL;
    p_id := NULL;
    
    IF item_row.account_name LIKE 'Accounts Receivable (%)' THEN
      coa_id := public.get_coa_id(item_row.user_id, 'Accounts Receivable');
      clean_name := substring(item_row.account_name from 'Accounts Receivable \((.*)\)');
      SELECT id INTO p_id FROM public.customers WHERE user_id = item_row.user_id AND name = clean_name AND type = 'customer' LIMIT 1;
      
    ELSIF item_row.account_name LIKE 'Accounts Payable (%)' THEN
      coa_id := public.get_coa_id(item_row.user_id, 'Accounts Payable');
      clean_name := substring(item_row.account_name from 'Accounts Payable \((.*)\)');
      SELECT id INTO p_id FROM public.customers WHERE user_id = item_row.user_id AND name = clean_name AND type = 'supplier' LIMIT 1;
      
    ELSE
      coa_id := public.get_coa_id(item_row.user_id, item_row.account_name);
    END IF;
    
    IF coa_id IS NOT NULL THEN
      UPDATE public.journal_items SET account_id = coa_id, party_id = p_id WHERE id = item_row.id;
    END IF;
  END LOOP;
END;
$$;

-- Enforce NOT NULL on account_id in journal_items for new rows
ALTER TABLE public.journal_items ALTER COLUMN account_id SET NOT NULL;

-- 4. Deferred Double Entry Transaction Balance Validation Trigger
CREATE OR REPLACE FUNCTION public.check_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  debit_sum numeric(15, 2);
  credit_sum numeric(15, 2);
  e_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    e_id := OLD.entry_id;
  ELSE
    e_id := NEW.entry_id;
  END IF;

  -- Exit if parent entry has been deleted
  IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE id = e_id) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(debit), 0.00), COALESCE(SUM(credit), 0.00)
  INTO debit_sum, credit_sum
  FROM public.journal_items
  WHERE entry_id = e_id;

  IF ABS(debit_sum - credit_sum) > 0.01 THEN
    RAISE EXCEPTION 'Double-entry constraint check failed for Entry %: Total Debits (%) must equal Total Credits (%). Difference: %', 
      e_id, debit_sum, credit_sum, ABS(debit_sum - credit_sum);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_journal_entry_balance ON public.journal_items;
CREATE CONSTRAINT TRIGGER trg_check_journal_entry_balance
AFTER INSERT OR UPDATE OR DELETE ON public.journal_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_journal_entry_balance();

-- 5. Rebuilt Trigger for Invoices GL Sync (Perpetual Inventory + GST Splits)
CREATE OR REPLACE FUNCTION public.sync_invoice_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  cust_name text;
  cust_state text;
  biz_state text;
  cogs_value numeric(15, 2) := 0.00;
  cgst_amt numeric(15, 2) := 0.00;
  sgst_amt numeric(15, 2) := 0.00;
  igst_amt numeric(15, 2) := 0.00;
  is_intra boolean := true;
  ar_ap_acc uuid;
  rev_purch_acc uuid;
  inv_asset_acc uuid;
  cogs_acc uuid;
  cgst_acc uuid;
  sgst_acc uuid;
  igst_acc uuid;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'invoice';
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  IF NEW.document_kind NOT IN ('sale_invoice', 'purchase_bill') THEN
    RETURN NEW;
  END IF;

  SELECT name, state INTO cust_name, cust_state FROM public.customers WHERE id = NEW.customer_id;
  cust_name := COALESCE(cust_name, 'Walk-in Party');

  SELECT state INTO biz_state FROM public.business_profile WHERE user_id = NEW.user_id;

  IF cust_state IS NOT NULL AND biz_state IS NOT NULL AND lower(trim(cust_state)) != lower(trim(biz_state)) THEN
    is_intra := false;
  END IF;

  IF NEW.gst_amount > 0 THEN
    IF is_intra THEN
      cgst_amt := round(NEW.gst_amount / 2.0, 2);
      sgst_amt := NEW.gst_amount - cgst_amt;
    ELSE
      igst_amt := NEW.gst_amount;
    END IF;
  END IF;

  -- Insert JV header
  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'JV-' || NEW.invoice_no,
    NEW.date,
    CASE WHEN NEW.document_kind = 'sale_invoice' THEN 'Sales Invoice to ' || cust_name ELSE 'Purchase Bill from ' || cust_name END,
    NEW.id,
    'invoice'
  ) RETURNING id INTO je_id;

  inv_asset_acc := public.get_coa_id(NEW.user_id, 'Inventory Asset');
  cogs_acc      := public.get_coa_id(NEW.user_id, 'Cost of Goods Sold');

  IF NEW.document_kind = 'sale_invoice' THEN
    ar_ap_acc     := public.get_coa_id(NEW.user_id, 'Accounts Receivable');
    rev_purch_acc := public.get_coa_id(NEW.user_id, 'Sales Revenue');
    
    cgst_acc := public.get_coa_id(NEW.user_id, 'CGST Output Tax');
    sgst_acc := public.get_coa_id(NEW.user_id, 'SGST Output Tax');
    igst_acc := public.get_coa_id(NEW.user_id, 'IGST Output Tax');

    -- AR (Debit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, ar_ap_acc, NEW.customer_id, NEW.total, 0.00);

    -- Sales Revenue (Credit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, rev_purch_acc, 0.00, NEW.subtotal);

    -- GST Output Tax (Credit)
    IF NEW.gst_amount > 0 THEN
      IF is_intra THEN
        INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
        VALUES (NEW.user_id, je_id, cgst_acc, 0.00, cgst_amt);
        INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
        VALUES (NEW.user_id, je_id, sgst_acc, 0.00, sgst_amt);
      ELSE
        INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
        VALUES (NEW.user_id, je_id, igst_acc, 0.00, igst_amt);
      END IF;
    END IF;

    -- COGS perpetual calculation
    SELECT COALESCE(SUM(ii.qty * COALESCE(p.purchase_price, 0)), 0.00)
    INTO cogs_value
    FROM public.invoice_items ii
    LEFT JOIN public.products p ON p.id = ii.product_id
    WHERE ii.invoice_id = NEW.id AND COALESCE(p.is_service, false) = false;

    -- COGS (Debit) vs Inventory Asset (Credit)
    IF cogs_value > 0 THEN
      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (NEW.user_id, je_id, cogs_acc, cogs_value, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (NEW.user_id, je_id, inv_asset_acc, 0.00, cogs_value);
    END IF;

  ELSE -- purchase_bill
    ar_ap_acc     := public.get_coa_id(NEW.user_id, 'Accounts Payable');
    
    cgst_acc := public.get_coa_id(NEW.user_id, 'CGST Input Tax');
    sgst_acc := public.get_coa_id(NEW.user_id, 'SGST Input Tax');
    igst_acc := public.get_coa_id(NEW.user_id, 'IGST Input Tax');

    -- Inventory Asset (Debit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, inv_asset_acc, NEW.subtotal, 0.00);

    -- GST Input Tax (Debit)
    IF NEW.gst_amount > 0 THEN
      IF is_intra THEN
        INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
        VALUES (NEW.user_id, je_id, cgst_acc, cgst_amt, 0.00);
        INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
        VALUES (NEW.user_id, je_id, sgst_acc, sgst_amt, 0.00);
      ELSE
        INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
        VALUES (NEW.user_id, je_id, igst_acc, igst_amt, 0.00);
      END IF;
    END IF;

    -- Accounts Payable (Credit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, ar_ap_acc, NEW.customer_id, 0.00, NEW.total);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_invoice_journal ON public.invoices;
CREATE TRIGGER trg_sync_invoice_journal
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_journal();

-- 6. Rebuilt Trigger for Payments GL Sync (with party_id links and COA resolver)
CREATE OR REPLACE FUNCTION public.sync_payment_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  cust_name TEXT;
  cust_type TEXT;
  inv_no TEXT;
  ref_desc TEXT;
  ar_ap_acc_name TEXT;
  ar_ap_acc_id UUID;
  cash_bank_acc_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type IN ('payment', 'payment_reversal');
    RETURN OLD;
  END IF;

  SELECT name, type INTO cust_name, cust_type FROM public.customers WHERE id = NEW.customer_id;
  cust_name := COALESCE(cust_name, 'Walk-in Party');
  cust_type := COALESCE(cust_type, 'customer');

  IF cust_type = 'supplier' THEN
    ar_ap_acc_name := 'Accounts Payable';
  ELSE
    ar_ap_acc_name := 'Accounts Receivable';
  END IF;
  
  ar_ap_acc_id     := public.get_coa_id(NEW.user_id, ar_ap_acc_name);
  cash_bank_acc_id := public.get_coa_id(NEW.user_id, CASE WHEN COALESCE(NEW.payment_mode, 'Cash') = 'Cash' THEN 'Cash Book' ELSE 'Bank Account' END);

  IF OLD.status = 'active' AND NEW.status = 'reversed' THEN
    DELETE FROM public.journal_entries WHERE reference_id = NEW.id AND reference_type = 'payment_reversal';

    INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
    VALUES (
      NEW.user_id,
      'REV-PMT-' || substring(NEW.id::text, 1, 8),
      COALESCE(NEW.reversed_at, NOW())::date,
      'REVERSAL of payment PMT-' || substring(NEW.id::text, 1, 8) || ' (' || cust_name || ')' || COALESCE(' - Reason: ' || NEW.reversal_reason, ''),
      NEW.id,
      'payment_reversal'
    ) RETURNING id INTO je_id;

    IF cust_type = 'supplier' THEN
      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, NEW.customer_id, 0.00, NEW.amount);
    ELSE
      INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, NEW.customer_id, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, 0.00, NEW.amount);
    END IF;

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

    INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
    VALUES (
      NEW.user_id,
      'PMT-' || substring(NEW.id::text, 1, 8),
      NEW.created_at::date,
      ref_desc,
      NEW.id,
      'payment'
    ) RETURNING id INTO je_id;

    IF cust_type = 'supplier' THEN
      INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, NEW.customer_id, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, 0.00, NEW.amount);
    ELSE
      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, NEW.customer_id, 0.00, NEW.amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_payment_journal ON public.invoice_payments;
CREATE TRIGGER trg_sync_payment_journal
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_journal();

-- 7. Rebuilt Trigger for Expenses GL Sync
CREATE OR REPLACE FUNCTION public.sync_expense_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  expense_acc_id uuid;
  cash_bank_acc_id uuid;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'expense';
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  expense_acc_id   := public.get_coa_id(NEW.user_id, 'General Expense');
  cash_bank_acc_id := public.get_coa_id(NEW.user_id, CASE WHEN COALESCE(NEW.payment_mode, 'Cash') = 'Cash' THEN 'Cash Book' ELSE 'Bank Account' END);

  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'EXP-' || substring(NEW.id::text, 1, 8),
    NEW.date,
    'Expense: ' || COALESCE(NEW.category, 'Other') || ' - ' || COALESCE(NEW.description, ''),
    NEW.id,
    'expense'
  ) RETURNING id INTO je_id;

  INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
  VALUES (NEW.user_id, je_id, expense_acc_id, NEW.amount, 0.00);

  INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
  VALUES (NEW.user_id, je_id, cash_bank_acc_id, 0.00, NEW.amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_expense_journal ON public.expenses;
CREATE TRIGGER trg_sync_expense_journal
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_expense_journal();

-- 8. Rebuilt Trigger for Stock Adjustments GL Sync
CREATE OR REPLACE FUNCTION public.sync_stock_adjustment_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  prod_name TEXT;
  prod_price NUMERIC;
  adj_value NUMERIC;
  expense_acc_id UUID;
  gain_acc_id UUID;
  inv_asset_acc_id UUID;
  reason_acc_name TEXT;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'stock_adjustment';

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT name, COALESCE(purchase_price, 0) INTO prod_name, prod_price
  FROM public.products WHERE id = NEW.product_id;

  adj_value := ABS(NEW.qty) * prod_price;

  IF adj_value <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'STK-' || substring(NEW.id::text, 1, 8),
    NEW.created_at::date,
    NEW.reason || ' for product: ' || prod_name || ' (Qty: ' || NEW.qty || ')',
    NEW.id,
    'stock_adjustment'
  ) RETURNING id INTO je_id;

  inv_asset_acc_id := public.get_coa_id(NEW.user_id, 'Inventory Asset');

  IF NEW.qty < 0 THEN
    IF NEW.reason = 'Damaged Goods' THEN
      reason_acc_name := 'Loss on Damaged Goods';
    ELSIF NEW.reason = 'Theft or Loss' THEN
      reason_acc_name := 'Loss of Stock (Theft/Loss)';
    ELSE
      reason_acc_name := 'Inventory Adjustment Expense';
    END IF;
    expense_acc_id := public.get_coa_id(NEW.user_id, reason_acc_name);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, expense_acc_id, adj_value, 0.00);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, inv_asset_acc_id, 0.00, adj_value);

  ELSE
    gain_acc_id := public.get_coa_id(NEW.user_id, 'Inventory Surplus/Gain');

    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, inv_asset_acc_id, adj_value, 0.00);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, gain_acc_id, 0.00, adj_value);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_stock_adjustment_journal ON public.stock_adjustments;
CREATE TRIGGER trg_sync_stock_adjustment_journal
AFTER INSERT OR UPDATE OR DELETE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_adjustment_journal();

-- 9. Rebuilt Trigger for Party Opening Balances GL Sync
CREATE OR REPLACE FUNCTION public.sync_customer_opening_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  opp_account_id uuid;
  party_account_id uuid;
  is_dr boolean;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'opening_balance';

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.opening_balance, 0) = 0 THEN
    RETURN NEW;
  END IF;

  opp_account_id := public.get_coa_id(NEW.user_id, 'Opening Balance Equity');

  IF NEW.type = 'customer' THEN
    party_account_id := public.get_coa_id(NEW.user_id, 'Accounts Receivable');
    IF COALESCE(NEW.opening_balance_type, 'Dr') = 'Dr' THEN
      is_dr := true;
    ELSE
      is_dr := false;
    END IF;
  ELSE
    party_account_id := public.get_coa_id(NEW.user_id, 'Accounts Payable');
    IF COALESCE(NEW.opening_balance_type, 'Cr') = 'Cr' THEN
      is_dr := false;
    ELSE
      is_dr := true;
    END IF;
  END IF;

  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'OPB-' || substring(NEW.id::text, 1, 8),
    NEW.created_at::date,
    'Opening Balance for ' || NEW.name,
    NEW.id,
    'opening_balance'
  ) RETURNING id INTO je_id;

  IF is_dr THEN
    INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, party_account_id, NEW.id, NEW.opening_balance, 0.00);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, opp_account_id, 0.00, NEW.opening_balance);
  ELSE
    INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
    VALUES (NEW.user_id, je_id, opp_account_id, NEW.opening_balance, 0.00);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, party_account_id, NEW.id, 0.00, NEW.opening_balance);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_customer_opening_journal ON public.customers;
CREATE TRIGGER trg_sync_customer_opening_journal
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_opening_journal();

-- 10. Product Opening Stock GL Sync Trigger (Fixes Day 1 Inventory ledger discrepancies)
CREATE OR REPLACE FUNCTION public.sync_product_opening_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  inv_asset_acc_id uuid;
  opp_account_id uuid;
  val_amount numeric(15, 2);
  p_id uuid;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'product_opening';

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  val_amount := COALESCE(NEW.stock, 0.00) * COALESCE(NEW.purchase_price, 0.00);

  IF val_amount <= 0 OR COALESCE(NEW.is_service, false) = true THEN
    RETURN NEW;
  END IF;

  inv_asset_acc_id := public.get_coa_id(NEW.user_id, 'Inventory Asset');
  opp_account_id   := public.get_coa_id(NEW.user_id, 'Opening Balance Equity');

  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'STK-OP-' || substring(NEW.id::text, 1, 8),
    NEW.created_at::date,
    'Opening Inventory Stock for ' || NEW.name || ' (Qty: ' || NEW.stock || ' @ cost ' || NEW.purchase_price || ')',
    NEW.id,
    'product_opening'
  ) RETURNING id INTO je_id;

  INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
  VALUES (NEW.user_id, je_id, inv_asset_acc_id, val_amount, 0.00);

  INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
  VALUES (NEW.user_id, je_id, opp_account_id, 0.00, val_amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_product_opening_journal ON public.products;
CREATE TRIGGER trg_sync_product_opening_journal
AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_opening_journal();

-- Seed opening stock JVs for all existing products
DO $$
DECLARE
  prod_row record;
  val_amount numeric(15, 2);
  je_id uuid;
  inv_asset_acc_id uuid;
  opp_account_id uuid;
BEGIN
  FOR prod_row IN SELECT id, user_id, name, stock, purchase_price, created_at FROM public.products WHERE COALESCE(is_service, false) = false AND COALESCE(stock, 0) > 0 AND COALESCE(purchase_price, 0) > 0 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE reference_id = prod_row.id AND reference_type = 'product_opening') THEN
      val_amount := prod_row.stock * prod_row.purchase_price;
      inv_asset_acc_id := public.get_coa_id(prod_row.user_id, 'Inventory Asset');
      opp_account_id   := public.get_coa_id(prod_row.user_id, 'Opening Balance Equity');

      INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
      VALUES (
        prod_row.user_id,
        'STK-OP-' || substring(prod_row.id::text, 1, 8),
        prod_row.created_at::date,
        'Opening Inventory Stock for ' || prod_row.name || ' (Qty: ' || prod_row.stock || ' @ cost ' || prod_row.purchase_price || ')',
        prod_row.id,
        'product_opening'
      ) RETURNING id INTO je_id;

      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (prod_row.user_id, je_id, inv_asset_acc_id, val_amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, debit, credit)
      VALUES (prod_row.user_id, je_id, opp_account_id, 0.00, val_amount);
    END IF;
  END LOOP;
END;
$$;
