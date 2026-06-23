-- ============================================================
-- myBillBook Clone — Database Performance Hardening Upgrades
-- Run this script inside your Supabase Dashboard SQL Editor
-- ============================================================

-- Safe index creation helper function
CREATE OR REPLACE FUNCTION public.create_index_safely(
    target_table text,
    target_index text,
    index_definition text
) RETURNS void AS $$
BEGIN
    -- Check if the table exists in the public schema
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = target_table
    ) THEN
        -- Run the index creation SQL statement
        EXECUTE index_definition;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. Customers/Suppliers Indexes
SELECT public.create_index_safely('customers', 'idx_customers_user_id', 'CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers (user_id)');
SELECT public.create_index_safely('customers', 'idx_customers_user_type_name', 'CREATE INDEX IF NOT EXISTS idx_customers_user_type_name ON public.customers (user_id, type, name)');

-- 2. Products Indexes
SELECT public.create_index_safely('products', 'idx_products_user_id', 'CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products (user_id)');
SELECT public.create_index_safely('products', 'idx_products_user_name', 'CREATE INDEX IF NOT EXISTS idx_products_user_name ON public.products (user_id, name)');

-- 3. Invoices Indexes
SELECT public.create_index_safely('invoices', 'idx_invoices_user_id', 'CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices (user_id)');
SELECT public.create_index_safely('invoices', 'idx_invoices_customer_id', 'CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id)');
SELECT public.create_index_safely('invoices', 'idx_invoices_reference_invoice_id', 'CREATE INDEX IF NOT EXISTS idx_invoices_reference_invoice_id ON public.invoices (reference_invoice_id)');
SELECT public.create_index_safely('invoices', 'idx_invoices_user_date', 'CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON public.invoices (user_id, date DESC)');

-- 4. Invoice Items Indexes
SELECT public.create_index_safely('invoice_items', 'idx_invoice_items_user_id', 'CREATE INDEX IF NOT EXISTS idx_invoice_items_user_id ON public.invoice_items (user_id)');
SELECT public.create_index_safely('invoice_items', 'idx_invoice_items_invoice_id', 'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id)');
SELECT public.create_index_safely('invoice_items', 'idx_invoice_items_product_id', 'CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items (product_id)');

-- 5. Invoice Payments Indexes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invoice_payments'
    ) THEN
        ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END $$;

SELECT public.create_index_safely('invoice_payments', 'idx_invoice_payments_user_id', 'CREATE INDEX IF NOT EXISTS idx_invoice_payments_user_id ON public.invoice_payments (user_id)');
SELECT public.create_index_safely('invoice_payments', 'idx_invoice_payments_invoice_id', 'CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments (invoice_id)');
SELECT public.create_index_safely('invoice_payments', 'idx_invoice_payments_customer_id', 'CREATE INDEX IF NOT EXISTS idx_invoice_payments_customer_id ON public.invoice_payments (customer_id)');

-- 6. Payment Allocations Indexes
SELECT public.create_index_safely('payment_allocations', 'idx_payment_allocations_user_id', 'CREATE INDEX IF NOT EXISTS idx_payment_allocations_user_id ON public.payment_allocations (user_id)');
SELECT public.create_index_safely('payment_allocations', 'idx_payment_allocations_payment_id', 'CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations (payment_id)');
SELECT public.create_index_safely('payment_allocations', 'idx_payment_allocations_invoice_id', 'CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON public.payment_allocations (invoice_id)');

-- 7. Expenses Indexes
SELECT public.create_index_safely('expenses', 'idx_expenses_user_id', 'CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id)');
SELECT public.create_index_safely('expenses', 'idx_expenses_user_date', 'CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses (user_id, date DESC)');

-- 8. Journal Entries Indexes
SELECT public.create_index_safely('journal_entries', 'idx_journal_entries_user_id', 'CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON public.journal_entries (user_id)');
SELECT public.create_index_safely('journal_entries', 'idx_journal_entries_reference_id', 'CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_id ON public.journal_entries (reference_id)');
SELECT public.create_index_safely('journal_entries', 'idx_journal_entries_user_date', 'CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries (user_id, date DESC)');

-- 9. Journal Items Indexes
SELECT public.create_index_safely('journal_items', 'idx_journal_items_user_id', 'CREATE INDEX IF NOT EXISTS idx_journal_items_user_id ON public.journal_items (user_id)');
SELECT public.create_index_safely('journal_items', 'idx_journal_items_entry_id', 'CREATE INDEX IF NOT EXISTS idx_journal_items_entry_id ON public.journal_items (entry_id)');
SELECT public.create_index_safely('journal_items', 'idx_journal_items_account_id', 'CREATE INDEX IF NOT EXISTS idx_journal_items_account_id ON public.journal_items (account_id)');
SELECT public.create_index_safely('journal_items', 'idx_journal_items_party_id', 'CREATE INDEX IF NOT EXISTS idx_journal_items_party_id ON public.journal_items (party_id)');
SELECT public.create_index_safely('journal_items', 'idx_journal_items_user_account', 'CREATE INDEX IF NOT EXISTS idx_journal_items_user_account ON public.journal_items (user_id, account_id)');
SELECT public.create_index_safely('journal_items', 'idx_journal_items_user_party', 'CREATE INDEX IF NOT EXISTS idx_journal_items_user_party ON public.journal_items (user_id, party_id)');

-- 10. Warehouses & Stocks Indexes
SELECT public.create_index_safely('warehouses', 'idx_warehouses_user_id', 'CREATE INDEX IF NOT EXISTS idx_warehouses_user_id ON public.warehouses (user_id)');
SELECT public.create_index_safely('warehouse_stocks', 'idx_warehouse_stocks_user_id', 'CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_user_id ON public.warehouse_stocks (user_id)');
SELECT public.create_index_safely('warehouse_stocks', 'idx_warehouse_stocks_warehouse_id', 'CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_warehouse_id ON public.warehouse_stocks (warehouse_id)');
SELECT public.create_index_safely('warehouse_stocks', 'idx_warehouse_stocks_product_id', 'CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_product_id ON public.warehouse_stocks (product_id)');

-- 11. Stock Adjustments & Transfers Indexes
SELECT public.create_index_safely('stock_adjustments', 'idx_stock_adjustments_user_id', 'CREATE INDEX IF NOT EXISTS idx_stock_adjustments_user_id ON public.stock_adjustments (user_id)');
SELECT public.create_index_safely('stock_adjustments', 'idx_stock_adjustments_product_id', 'CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON public.stock_adjustments (product_id)');
SELECT public.create_index_safely('stock_transfers', 'idx_stock_transfers_user_id', 'CREATE INDEX IF NOT EXISTS idx_stock_transfers_user_id ON public.stock_transfers (user_id)');
SELECT public.create_index_safely('stock_transfers', 'idx_stock_transfers_product_id', 'CREATE INDEX IF NOT EXISTS idx_stock_transfers_product_id ON public.stock_transfers (product_id)');
SELECT public.create_index_safely('stock_transfers', 'idx_stock_transfers_from_warehouse_id', 'CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_warehouse_id ON public.stock_transfers (from_warehouse_id)');
SELECT public.create_index_safely('stock_transfers', 'idx_stock_transfers_to_warehouse_id', 'CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_warehouse_id ON public.stock_transfers (to_warehouse_id)');

-- 12. Reminders & Alerts Indexes
SELECT public.create_index_safely('payment_reminders', 'idx_payment_reminders_user_id', 'CREATE INDEX IF NOT EXISTS idx_payment_reminders_user_id ON public.payment_reminders (user_id)');
SELECT public.create_index_safely('payment_reminders', 'idx_payment_reminders_invoice_id', 'CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice_id ON public.payment_reminders (invoice_id)');
SELECT public.create_index_safely('payment_reminders', 'idx_payment_reminders_customer_id', 'CREATE INDEX IF NOT EXISTS idx_payment_reminders_customer_id ON public.payment_reminders (customer_id)');
SELECT public.create_index_safely('stock_alerts', 'idx_stock_alerts_user_id', 'CREATE INDEX IF NOT EXISTS idx_stock_alerts_user_id ON public.stock_alerts (user_id)');
SELECT public.create_index_safely('stock_alerts', 'idx_stock_alerts_product_id', 'CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON public.stock_alerts (product_id)');

-- 13. Recurring Invoices Indexes
SELECT public.create_index_safely('recurring_invoices', 'idx_recurring_invoices_user_id', 'CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user_id ON public.recurring_invoices (user_id)');
SELECT public.create_index_safely('recurring_invoices', 'idx_recurring_invoices_base_invoice_id', 'CREATE INDEX IF NOT EXISTS idx_recurring_invoices_base_invoice_id ON public.recurring_invoices (base_invoice_id)');
SELECT public.create_index_safely('recurring_invoices', 'idx_recurring_invoices_customer_id', 'CREATE INDEX IF NOT EXISTS idx_recurring_invoices_customer_id ON public.recurring_invoices (customer_id)');

-- 14. Chart of Accounts Indexes
SELECT public.create_index_safely('chart_of_accounts', 'idx_chart_of_accounts_user_id', 'CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON public.chart_of_accounts (user_id)');

-- 15. Audit Logs & System Indexes
SELECT public.create_index_safely('audit_logs', 'idx_audit_logs_user_id', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id)');
SELECT public.create_index_safely('team_invites', 'idx_team_invites_owner_id', 'CREATE INDEX IF NOT EXISTS idx_team_invites_owner_id ON public.team_invites (owner_id)');
SELECT public.create_index_safely('user_roles', 'idx_user_roles_user_id', 'CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id)');
SELECT public.create_index_safely('migration_jobs', 'idx_migration_jobs_user_id', 'CREATE INDEX IF NOT EXISTS idx_migration_jobs_user_id ON public.migration_jobs (user_id)');

-- Cleanup helper function
DROP FUNCTION IF EXISTS public.create_index_safely(text, text, text);
