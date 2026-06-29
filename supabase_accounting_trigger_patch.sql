-- =================================================================
-- myBillBook Clone — Accounting Journal Triggers Patch (COMPLETE)
-- Fixes "null value in column 'account_name' of relation 'journal_items'"
-- Paste and Run this inside your Supabase Dashboard SQL Editor
-- =================================================================

-- 1. PATCH FOR PRODUCT OPENING STOCK JOURNAL SYNC
CREATE OR REPLACE FUNCTION public.sync_product_opening_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  inv_asset_acc_id uuid;
  opp_account_id uuid;
  val_amount numeric(15, 2);
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

  INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
  VALUES (
    NEW.user_id, 
    je_id, 
    inv_asset_acc_id, 
    COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = inv_asset_acc_id), 'Inventory Asset'), 
    val_amount, 
    0.00
  );

  INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
  VALUES (
    NEW.user_id, 
    je_id, 
    opp_account_id, 
    COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = opp_account_id), 'Opening Balance Equity'), 
    0.00, 
    val_amount
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. PATCH FOR STOCK ADJUSTMENT JOURNAL SYNC
CREATE OR REPLACE FUNCTION public.sync_stock_adjustment_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  prod_name text;
  inv_asset_acc_id uuid;
  gain_acc_id uuid;
  loss_acc_id uuid;
  adj_value numeric(15, 2);
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'stock_adjustment';

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  SELECT name INTO prod_name FROM public.products WHERE id = NEW.product_id;
  
  -- Calculate adjustment value based on purchase_price
  adj_value := ABS(NEW.qty) * COALESCE((SELECT purchase_price FROM public.products WHERE id = NEW.product_id), 0.00);

  IF adj_value <= 0 THEN
    RETURN NEW;
  END IF;

  inv_asset_acc_id := public.get_coa_id(NEW.user_id, 'Inventory Asset');
  gain_acc_id      := public.get_coa_id(NEW.user_id, 'Other Income');
  loss_acc_id      := public.get_coa_id(NEW.user_id, 'Cost of Goods Sold');

  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'STK-ADJ-' || substring(NEW.id::text, 1, 8),
    NEW.created_at::date,
    'Stock Adjustment for ' || COALESCE(prod_name, 'Product') || ' (Qty: ' || NEW.qty || ', Reason: ' || COALESCE(NEW.reason, 'Manual') || ')',
    NEW.id,
    'stock_adjustment'
  ) RETURNING id INTO je_id;

  IF NEW.qty > 0 THEN
    -- Stock Increase (Debit Inventory Asset, Credit Other Income/Gain)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (
      NEW.user_id, 
      je_id, 
      inv_asset_acc_id, 
      COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = inv_asset_acc_id), 'Inventory Asset'), 
      adj_value, 
      0.00
    );

    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (
      NEW.user_id, 
      je_id, 
      gain_acc_id, 
      COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = gain_acc_id), 'Other Income'), 
      0.00, 
      adj_value
    );
  ELSE
    -- Stock Decrease (Debit Cost of Goods Sold/Loss, Credit Inventory Asset)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (
      NEW.user_id, 
      je_id, 
      loss_acc_id, 
      COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = loss_acc_id), 'Cost of Goods Sold'), 
      adj_value, 
      0.00
    );

    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (
      NEW.user_id, 
      je_id, 
      inv_asset_acc_id, 
      COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = inv_asset_acc_id), 'Inventory Asset'), 
      0.00, 
      adj_value
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PATCH FOR CUSTOMER/SUPPLIER OPENING BALANCE JOURNAL SYNC
CREATE OR REPLACE FUNCTION public.sync_customer_opening_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  opp_account_id uuid;
  party_account_id uuid;
  is_dr boolean;
  party_acc_name text;
  opp_acc_name text;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'opening_balance';

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.opening_balance, 0) = 0 THEN
    RETURN NEW;
  END IF;

  opp_account_id := public.get_coa_id(NEW.user_id, 'Opening Balance Equity');
  opp_acc_name   := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = opp_account_id), 'Opening Balance Equity');

  IF NEW.type = 'customer' THEN
    party_account_id := public.get_coa_id(NEW.user_id, 'Accounts Receivable');
    party_acc_name   := 'Accounts Receivable (' || NEW.name || ')';
    IF COALESCE(NEW.opening_balance_type, 'Dr') = 'Dr' THEN
      is_dr := true;
    ELSE
      is_dr := false;
    END IF;
  ELSE
    party_account_id := public.get_coa_id(NEW.user_id, 'Accounts Payable');
    party_acc_name   := 'Accounts Payable (' || NEW.name || ')';
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
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, party_account_id, party_acc_name, NEW.id, NEW.opening_balance, 0.00);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, opp_account_id, opp_acc_name, 0.00, NEW.opening_balance);
  ELSE
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, opp_account_id, opp_acc_name, NEW.opening_balance, 0.00);

    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, party_account_id, party_acc_name, NEW.id, 0.00, NEW.opening_balance);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PATCH FOR INVOICES GL JOURNAL SYNC
CREATE OR REPLACE FUNCTION public.sync_invoice_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  cust_name text;
  cust_state text;
  biz_state text;
  is_intra boolean := true;
  cgst_amt numeric(15, 2) := 0;
  sgst_amt numeric(15, 2) := 0;
  igst_amt numeric(15, 2) := 0;
  inv_asset_acc uuid;
  cogs_acc uuid;
  ar_ap_acc uuid;
  rev_purch_acc uuid;
  cgst_acc uuid;
  sgst_acc uuid;
  igst_acc uuid;
  cogs_value numeric(15, 2) := 0.00;
  ar_ap_name text;
  rev_purch_name text;
  cgst_name text;
  sgst_name text;
  igst_name text;
  inv_asset_name text;
  cogs_name text;
  gen_exp_acc uuid;
  gen_exp_name text;
  diff numeric(15, 2) := 0.00;
BEGIN
  -- Delete old journal entries if any
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
  inv_asset_name:= COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = inv_asset_acc), 'Inventory Asset');
  cogs_name     := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = cogs_acc), 'Cost of Goods Sold');

  IF NEW.document_kind = 'sale_invoice' THEN
    ar_ap_acc     := public.get_coa_id(NEW.user_id, 'Accounts Receivable');
    rev_purch_acc := public.get_coa_id(NEW.user_id, 'Sales Revenue');
    cgst_acc := public.get_coa_id(NEW.user_id, 'CGST Output Tax');
    sgst_acc := public.get_coa_id(NEW.user_id, 'SGST Output Tax');
    igst_acc := public.get_coa_id(NEW.user_id, 'IGST Output Tax');

    ar_ap_name     := 'Accounts Receivable (' || cust_name || ')';
    rev_purch_name := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = rev_purch_acc), 'Sales Revenue');
    cgst_name      := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = cgst_acc), 'CGST Output Tax');
    sgst_name      := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = sgst_acc), 'SGST Output Tax');
    igst_name      := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = igst_acc), 'IGST Output Tax');

    -- AR (Debit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, ar_ap_acc, ar_ap_name, NEW.customer_id, NEW.total, 0.00);

    -- Sales Revenue (Credit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, rev_purch_acc, rev_purch_name, 0.00, NEW.subtotal);

    -- GST Output Tax (Credit)
    IF NEW.gst_amount > 0 THEN
      IF is_intra THEN
        INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
        VALUES (NEW.user_id, je_id, cgst_acc, cgst_name, 0.00, cgst_amt);
        INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
        VALUES (NEW.user_id, je_id, sgst_acc, sgst_name, 0.00, sgst_amt);
      ELSE
        INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
        VALUES (NEW.user_id, je_id, igst_acc, igst_name, 0.00, igst_amt);
      END IF;
    END IF;

    -- Balancer for shipping charges, discounts, and round-offs
    diff := NEW.total - (NEW.subtotal + NEW.gst_amount);
    IF diff > 0.00 THEN
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, rev_purch_acc, rev_purch_name, 0.00, diff);
    ELSIF diff < 0.00 THEN
      gen_exp_acc := public.get_coa_id(NEW.user_id, 'General Expense');
      gen_exp_name := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = gen_exp_acc), 'General Expense');
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, gen_exp_acc, gen_exp_name, abs(diff), 0.00);
    END IF;

    -- COGS perpetual calculation
    SELECT COALESCE(SUM(ii.qty * COALESCE(p.purchase_price, 0)), 0.00)
    INTO cogs_value
    FROM public.invoice_items ii
    LEFT JOIN public.products p ON p.id = ii.product_id
    WHERE ii.invoice_id = NEW.id AND COALESCE(p.is_service, false) = false;

    -- COGS (Debit) vs Inventory Asset (Credit)
    IF cogs_value > 0 THEN
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cogs_acc, cogs_name, cogs_value, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, inv_asset_acc, inv_asset_name, 0.00, cogs_value);
    END IF;

  ELSE -- purchase_bill
    ar_ap_acc     := public.get_coa_id(NEW.user_id, 'Accounts Payable');
    cgst_acc := public.get_coa_id(NEW.user_id, 'CGST Input Tax');
    sgst_acc := public.get_coa_id(NEW.user_id, 'SGST Input Tax');
    igst_acc := public.get_coa_id(NEW.user_id, 'IGST Input Tax');

    ar_ap_name     := 'Accounts Payable (' || cust_name || ')';
    cgst_name      := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = cgst_acc), 'CGST Input Tax');
    sgst_name      := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = sgst_acc), 'SGST Input Tax');
    igst_name      := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = igst_acc), 'IGST Input Tax');

    -- Inventory Asset (Debit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, inv_asset_acc, inv_asset_name, NEW.subtotal, 0.00);

    -- GST Input Tax (Debit)
    IF NEW.gst_amount > 0 THEN
      IF is_intra THEN
        INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
        VALUES (NEW.user_id, je_id, cgst_acc, cgst_name, cgst_amt, 0.00);
        INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
        VALUES (NEW.user_id, je_id, sgst_acc, sgst_name, sgst_amt, 0.00);
      ELSE
        INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
        VALUES (NEW.user_id, je_id, igst_acc, igst_name, igst_amt, 0.00);
      END IF;
    END IF;

    -- Accounts Payable (Credit)
    INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
    VALUES (NEW.user_id, je_id, ar_ap_acc, ar_ap_name, NEW.customer_id, 0.00, NEW.total);

    -- Balancer for shipping charges, discounts, and round-offs
    diff := NEW.total - (NEW.subtotal + NEW.gst_amount);
    IF diff > 0.00 THEN
      gen_exp_acc := public.get_coa_id(NEW.user_id, 'General Expense');
      gen_exp_name := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = gen_exp_acc), 'General Expense');
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, gen_exp_acc, gen_exp_name, diff, 0.00);
    ELSIF diff < 0.00 THEN
      gen_exp_acc := public.get_coa_id(NEW.user_id, 'General Expense');
      gen_exp_name := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = gen_exp_acc), 'General Expense');
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, gen_exp_acc, gen_exp_name, 0.00, abs(diff));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. PATCH FOR PAYMENTS GL JOURNAL SYNC
CREATE OR REPLACE FUNCTION public.sync_payment_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  cust_name text;
  cust_type text;
  inv_no text;
  ref_desc text;
  ar_ap_acc_id uuid;
  cash_bank_acc_id uuid;
  ar_ap_name text;
  cash_bank_name text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type IN ('payment', 'payment_reversal');
    RETURN OLD;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT name, type INTO cust_name, cust_type FROM public.customers WHERE id = NEW.customer_id;
  END IF;

  IF cust_name IS NULL THEN
    cust_name := 'Walk-in Party';
  END IF;

  IF cust_type IS NULL THEN
    cust_type := 'customer';
  END IF;

  ar_ap_acc_id     := public.get_coa_id(NEW.user_id, CASE WHEN cust_type = 'supplier' THEN 'Accounts Payable' ELSE 'Accounts Receivable' END);
  cash_bank_acc_id := public.get_coa_id(NEW.user_id, CASE WHEN COALESCE(NEW.payment_mode, 'Cash') = 'Cash' THEN 'Cash Book' ELSE 'Bank Account' END);
  
  ar_ap_name     := CASE WHEN cust_type = 'supplier' THEN 'Accounts Payable (' || cust_name || ')' ELSE 'Accounts Receivable (' || cust_name || ')' END;
  cash_bank_name := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = cash_bank_acc_id), 'Cash Book');

  IF NEW.status = 'reversed' THEN
    DELETE FROM public.journal_entries WHERE reference_id = NEW.id AND reference_type = 'payment';

    INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
    VALUES (
      NEW.user_id,
      'REV-PMT-' || substring(NEW.id::text, 1, 8),
      NEW.created_at::date,
      'REVERSAL of payment PMT-' || substring(NEW.id::text, 1, 8) || ' (' || cust_name || ')' || COALESCE(' - Reason: ' || NEW.reversal_reason, ''),
      NEW.id,
      'payment_reversal'
    ) RETURNING id INTO je_id;

    IF cust_type = 'supplier' THEN
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, cash_bank_name, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, ar_ap_name, NEW.customer_id, 0.00, NEW.amount);
    ELSE
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, ar_ap_name, NEW.customer_id, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, cash_bank_name, 0.00, NEW.amount);
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
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, ar_ap_name, NEW.customer_id, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, cash_bank_name, 0.00, NEW.amount);
    ELSE
      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
      VALUES (NEW.user_id, je_id, cash_bank_acc_id, cash_bank_name, NEW.amount, 0.00);

      INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, party_id, debit, credit)
      VALUES (NEW.user_id, je_id, ar_ap_acc_id, ar_ap_name, NEW.customer_id, 0.00, NEW.amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PATCH FOR EXPENSES GL JOURNAL SYNC
CREATE OR REPLACE FUNCTION public.sync_expense_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id uuid;
  expense_acc_id uuid;
  cash_bank_acc_id uuid;
  expense_acc_name text;
  cash_bank_name text;
BEGIN
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'expense';
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  expense_acc_id   := public.get_coa_id(NEW.user_id, 'General Expense');
  cash_bank_acc_id := public.get_coa_id(NEW.user_id, CASE WHEN COALESCE(NEW.payment_mode, 'Cash') = 'Cash' THEN 'Cash Book' ELSE 'Bank Account' END);

  expense_acc_name := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = expense_acc_id), 'General Expense');
  cash_bank_name   := COALESCE((SELECT name FROM public.chart_of_accounts WHERE id = cash_bank_acc_id), 'Cash Book');

  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'EXP-' || substring(NEW.id::text, 1, 8),
    NEW.date,
    'Expense: ' || COALESCE(NEW.category, 'Other') || ' - ' || COALESCE(NEW.description, ''),
    NEW.id,
    'expense'
  ) RETURNING id INTO je_id;

  INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
  VALUES (NEW.user_id, je_id, expense_acc_id, expense_acc_name, NEW.amount, 0.00);

  INSERT INTO public.journal_items (user_id, entry_id, account_id, account_name, debit, credit)
  VALUES (NEW.user_id, je_id, cash_bank_acc_id, cash_bank_name, 0.00, NEW.amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
