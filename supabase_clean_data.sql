-- ⚠️ WARNING: running this script will delete ALL transaction, product, customer, and expense data.
-- It will NOT delete your login user or business profile.

-- 1. Delete Invoice Payments & Items first (Foreign Keys)
DELETE FROM public.invoice_payments;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;

-- 2. Delete Inventory & Stocks
DELETE FROM public.stock_adjustments;
DELETE FROM public.stock_transfers;
DELETE FROM public.warehouse_stocks;
DELETE FROM public.warehouses;
DELETE FROM public.stock_alerts;

-- 3. Delete Expenses
DELETE FROM public.expenses;

-- 4. Delete Accounting Journals
DELETE FROM public.journal_items;
DELETE FROM public.journal_entries;

-- 5. Delete Other Schedules & Invites
DELETE FROM public.payment_reminders;
DELETE FROM public.recurring_invoices;
DELETE FROM public.team_invites;

-- 6. Delete Products & Customers
DELETE FROM public.products;
DELETE FROM public.customers;

-- 7. Clean Logs
DELETE FROM public.audit_logs;
DELETE FROM public.migration_jobs;
