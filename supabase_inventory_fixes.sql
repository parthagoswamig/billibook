-- ============================================================
-- myBillBook Clone — Supabase Inventory Module Production Fixes
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- Clean up any existing negative stock values before applying constraints
UPDATE public.products SET stock = greatest(0, stock) WHERE stock < 0;
UPDATE public.warehouse_stocks SET stock = greatest(0, stock) WHERE stock < 0;

-- 1. Add Negative Stock CHECK Constraints
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative;
ALTER TABLE public.products ADD CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0);

ALTER TABLE public.warehouse_stocks DROP CONSTRAINT IF EXISTS chk_warehouse_stocks_stock_non_negative;
ALTER TABLE public.warehouse_stocks ADD CONSTRAINT chk_warehouse_stocks_stock_non_negative CHECK (stock >= 0);


-- 2. Trigger for Automatic Stock Adjustments
CREATE OR REPLACE FUNCTION public.sync_stock_adjustment_stock()
RETURNS TRIGGER AS $$
DECLARE
  prod_track_stock BOOLEAN;
  prod_is_service BOOLEAN;
BEGIN
  -- Check if product tracks stock and is not a service
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

  IF TG_OP = 'INSERT' THEN
    UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
    IF NEW.warehouse_id IS NOT NULL THEN
      INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
      VALUES (NEW.user_id, NEW.warehouse_id, NEW.product_id, NEW.qty)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products SET stock = stock - OLD.qty WHERE id = OLD.product_id;
    IF OLD.warehouse_id IS NOT NULL THEN
      UPDATE public.warehouse_stocks SET stock = stock - OLD.qty
      WHERE warehouse_id = OLD.warehouse_id AND product_id = OLD.product_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Revert old quantity
    UPDATE public.products SET stock = stock - OLD.qty WHERE id = OLD.product_id;
    IF OLD.warehouse_id IS NOT NULL THEN
      UPDATE public.warehouse_stocks SET stock = stock - OLD.qty
      WHERE warehouse_id = OLD.warehouse_id AND product_id = OLD.product_id;
    END IF;
    -- Apply new quantity
    UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
    IF NEW.warehouse_id IS NOT NULL THEN
      INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
      VALUES (NEW.user_id, NEW.warehouse_id, NEW.product_id, NEW.qty)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_stock_adjustment_stock ON public.stock_adjustments;
CREATE TRIGGER trg_sync_stock_adjustment_stock
AFTER INSERT OR UPDATE OR DELETE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_adjustment_stock();


-- 3. Trigger for Automatic Stock Transfers (Validation and Sync)
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


-- 4. Trigger for Inventory Accounting Integration (Journal Sync)
CREATE OR REPLACE FUNCTION public.sync_stock_adjustment_journal()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  prod_name TEXT;
  prod_price NUMERIC;
  adj_value NUMERIC;
  expense_account TEXT;
  gain_account TEXT := 'Inventory Surplus/Gain';
BEGIN
  -- Delete existing journal entry linked to this stock adjustment
  DELETE FROM public.journal_entries WHERE reference_id = OLD.id AND reference_type = 'stock_adjustment';

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Fetch product name and purchase_price
  SELECT name, COALESCE(purchase_price, 0) INTO prod_name, prod_price
  FROM public.products WHERE id = NEW.product_id;

  adj_value := ABS(NEW.qty) * prod_price;

  -- If value is zero, no journal entry is created
  IF adj_value <= 0 THEN
    RETURN NEW;
  END IF;

  -- Insert Journal Entry Header
  INSERT INTO public.journal_entries (user_id, entry_no, date, description, reference_id, reference_type)
  VALUES (
    NEW.user_id,
    'STK-' || substring(NEW.id::text, 1, 8),
    NEW.created_at::date,
    NEW.reason || ' for product: ' || prod_name || ' (Qty: ' || NEW.qty || ')',
    NEW.id,
    'stock_adjustment'
  ) RETURNING id INTO je_id;

  IF NEW.qty < 0 THEN
    -- Stock reduction (loss/write-off)
    IF NEW.reason = 'Damaged Goods' THEN
      expense_account := 'Loss on Damaged Goods';
    ELSIF NEW.reason = 'Theft or Loss' THEN
      expense_account := 'Loss of Stock (Theft/Loss)';
    ELSE
      expense_account := 'Inventory Adjustment Expense';
    END IF;

    -- Debit Expense Account
    INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, expense_account, adj_value, 0.00);

    -- Credit Inventory Asset
    INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, 'Inventory Asset', 0.00, adj_value);

  ELSE
    -- Stock addition (replenishment/surplus)
    -- Debit Inventory Asset
    INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, 'Inventory Asset', adj_value, 0.00);

    -- Credit Inventory Gain/Surplus
    INSERT INTO public.journal_items (user_id, entry_id, account_name, debit, credit)
    VALUES (NEW.user_id, je_id, gain_account, 0.00, adj_value);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_stock_adjustment_journal ON public.stock_adjustments;
CREATE TRIGGER trg_sync_stock_adjustment_journal
AFTER INSERT OR UPDATE OR DELETE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_adjustment_journal();


-- 5. Trigger for Warehouse Deletion Protection
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


-- 6. Trigger for Invoice Items (Automated Stock Synchronization)
CREATE OR REPLACE FUNCTION public.sync_invoice_item_stock()
RETURNS TRIGGER AS $$
DECLARE
  inv_kind TEXT;
  inv_wh_id UUID;
  inv_user_id UUID;
  prod_track_stock BOOLEAN;
  prod_is_service BOOLEAN;
  stock_mode TEXT;
BEGIN
  -- Fetch product information
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT track_stock, is_service INTO prod_track_stock, prod_is_service
    FROM public.products WHERE id = NEW.product_id;
  ELSE
    SELECT track_stock, is_service INTO prod_track_stock, prod_is_service
    FROM public.products WHERE id = OLD.product_id;
  END IF;

  -- If service product or not tracking stock, do nothing
  IF prod_is_service IS TRUE OR prod_track_stock IS FALSE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Fetch parent invoice details
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT document_kind, warehouse_id, user_id INTO inv_kind, inv_wh_id, inv_user_id
    FROM public.invoices WHERE id = NEW.invoice_id;
  ELSE
    SELECT document_kind, warehouse_id, user_id INTO inv_kind, inv_wh_id, inv_user_id
    FROM public.invoices WHERE id = OLD.invoice_id;
  END IF;

  -- Determine stock mode
  IF inv_kind IN ('sale_invoice', 'delivery_challan', 'purchase_return', 'debit_note') THEN
    stock_mode := 'out';
  ELSIF inv_kind IN ('credit_note', 'purchase_bill') THEN
    stock_mode := 'in';
  ELSE
    stock_mode := NULL;
  END IF;

  IF stock_mode IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- A. Revert OLD stock effect if DELETE or UPDATE
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF stock_mode = 'out' THEN
      UPDATE public.products SET stock = stock + OLD.qty WHERE id = OLD.product_id;
      IF inv_wh_id IS NOT NULL THEN
        INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
        VALUES (inv_user_id, inv_wh_id, OLD.product_id, OLD.qty)
        ON CONFLICT (warehouse_id, product_id) DO UPDATE
        SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
      END IF;
    ELSIF stock_mode = 'in' THEN
      UPDATE public.products SET stock = stock - OLD.qty WHERE id = OLD.product_id;
      IF inv_wh_id IS NOT NULL THEN
        INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
        VALUES (inv_user_id, inv_wh_id, OLD.product_id, -OLD.qty)
        ON CONFLICT (warehouse_id, product_id) DO UPDATE
        SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
      END IF;
    END IF;
  END IF;

  -- B. Apply NEW stock effect if INSERT or UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF stock_mode = 'out' THEN
      UPDATE public.products SET stock = stock - NEW.qty WHERE id = NEW.product_id;
      IF inv_wh_id IS NOT NULL THEN
        INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
        VALUES (inv_user_id, inv_wh_id, NEW.product_id, -NEW.qty)
        ON CONFLICT (warehouse_id, product_id) DO UPDATE
        SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
      END IF;
    ELSIF stock_mode = 'in' THEN
      UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
      IF inv_wh_id IS NOT NULL THEN
        INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
        VALUES (inv_user_id, inv_wh_id, NEW.product_id, NEW.qty)
        ON CONFLICT (warehouse_id, product_id) DO UPDATE
        SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_invoice_item_stock ON public.invoice_items;
CREATE TRIGGER trg_sync_invoice_item_stock
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_item_stock();


-- 7. Trigger on Invoices (for warehouse_id or document_kind changes)
CREATE OR REPLACE FUNCTION public.sync_invoice_stock_on_invoice_update()
RETURNS TRIGGER AS $$
DECLARE
  item_rec RECORD;
  old_stock_mode TEXT;
  new_stock_mode TEXT;
  prod_track_stock BOOLEAN;
  prod_is_service BOOLEAN;
BEGIN
  -- Only run if warehouse_id or document_kind changes
  IF OLD.warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id AND OLD.document_kind IS NOT DISTINCT FROM NEW.document_kind THEN
    RETURN NEW;
  END IF;

  -- Determine old and new stock modes
  IF OLD.document_kind IN ('sale_invoice', 'delivery_challan', 'purchase_return', 'debit_note') THEN
    old_stock_mode := 'out';
  ELSIF OLD.document_kind IN ('credit_note', 'purchase_bill') THEN
    old_stock_mode := 'in';
  ELSE
    old_stock_mode := NULL;
  END IF;

  IF NEW.document_kind IN ('sale_invoice', 'delivery_challan', 'purchase_return', 'debit_note') THEN
    new_stock_mode := 'out';
  ELSIF NEW.document_kind IN ('credit_note', 'purchase_bill') THEN
    new_stock_mode := 'in';
  ELSE
    new_stock_mode := NULL;
  END IF;

  -- Loop through each item in the invoice and adjust stock
  FOR item_rec IN SELECT * FROM public.invoice_items WHERE invoice_id = NEW.id LOOP
    SELECT track_stock, is_service INTO prod_track_stock, prod_is_service
    FROM public.products WHERE id = item_rec.product_id;

    IF prod_is_service IS NOT TRUE AND prod_track_stock IS TRUE THEN
      -- A. Revert OLD stock effect using old warehouse and old stock mode
      IF old_stock_mode IS NOT NULL THEN
        IF old_stock_mode = 'out' THEN
          UPDATE public.products SET stock = stock + item_rec.qty WHERE id = item_rec.product_id;
          IF OLD.warehouse_id IS NOT NULL THEN
            INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
            VALUES (OLD.user_id, OLD.warehouse_id, item_rec.product_id, item_rec.qty)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE
            SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
          END IF;
        ELSIF old_stock_mode = 'in' THEN
          UPDATE public.products SET stock = stock - item_rec.qty WHERE id = item_rec.product_id;
          IF OLD.warehouse_id IS NOT NULL THEN
            INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
            VALUES (OLD.user_id, OLD.warehouse_id, item_rec.product_id, -item_rec.qty)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE
            SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
          END IF;
        END IF;
      END IF;

      -- B. Apply NEW stock effect using new warehouse and new stock mode
      IF new_stock_mode IS NOT NULL THEN
        IF new_stock_mode = 'out' THEN
          UPDATE public.products SET stock = stock - item_rec.qty WHERE id = item_rec.product_id;
          IF NEW.warehouse_id IS NOT NULL THEN
            INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
            VALUES (NEW.user_id, NEW.warehouse_id, item_rec.product_id, -item_rec.qty)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE
            SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
          END IF;
        ELSIF new_stock_mode = 'in' THEN
          UPDATE public.products SET stock = stock + item_rec.qty WHERE id = item_rec.product_id;
          IF NEW.warehouse_id IS NOT NULL THEN
            INSERT INTO public.warehouse_stocks (user_id, warehouse_id, product_id, stock)
            VALUES (NEW.user_id, NEW.warehouse_id, item_rec.product_id, item_rec.qty)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE
            SET stock = public.warehouse_stocks.stock + EXCLUDED.stock;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_invoice_stock_on_invoice_update ON public.invoices;
CREATE TRIGGER trg_sync_invoice_stock_on_invoice_update
AFTER UPDATE OF warehouse_id, document_kind ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_stock_on_invoice_update();


-- 8. Redefine create_invoice_with_items RPC (Remove inline stock logic to let triggers handle it)
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
