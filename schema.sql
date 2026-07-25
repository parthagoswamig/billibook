-- ====================================================================
-- KHATAPE - GST/VAT Billing, Invoicing & Inventory Management System
-- Master Supabase Database Schema for CodeCanyon Buyers
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Business Profile Table (Multi-tenant Root)
CREATE TABLE IF NOT EXISTS public.business_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL DEFAULT 'My Business',
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    state TEXT DEFAULT 'Maharashtra',
    currency_symbol TEXT DEFAULT '₹',
    tax_label TEXT DEFAULT 'GST',
    invoice_prefix TEXT DEFAULT 'INV',
    default_due_days INTEGER DEFAULT 7,
    logo_url TEXT,
    plan TEXT DEFAULT 'free',
    appsumo_code TEXT,
    appsumo_stacking INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Customers & Suppliers (Parties) Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    address TEXT,
    state TEXT,
    type TEXT DEFAULT 'customer', -- 'customer' or 'supplier'
    opening_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Products & Inventory Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    hsn TEXT,
    unit TEXT DEFAULT 'Pcs',
    purchase_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    gst NUMERIC DEFAULT 18,
    stock NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 0,
    category TEXT DEFAULT 'General',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Warehouses Table
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'sale', -- 'sale' or 'purchase'
    document_kind TEXT NOT NULL DEFAULT 'sale_invoice', -- 'sale_invoice', 'quotation', 'estimate', 'proforma', 'delivery_challan', 'credit_note', 'debit_note', 'purchase_bill', 'purchase_return'
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    reference_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'partial', 'overdue'
    subtotal NUMERIC DEFAULT 0,
    gst_amount NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    round_off NUMERIC DEFAULT 0,
    shipping_charges NUMERIC DEFAULT 0,
    state_of_supply TEXT,
    total NUMERIC DEFAULT 0,
    paid NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    notes TEXT,
    last_payment_mode TEXT,
    last_payment_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Invoice Line Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    hsn TEXT,
    qty NUMERIC NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'Pcs',
    price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    gst NUMERIC DEFAULT 18,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Invoice Payments Record Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    payment_date DATE DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'General',
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    date DATE DEFAULT CURRENT_DATE,
    reference_no TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Cashbook / Ledger Entries
CREATE TABLE IF NOT EXISTS public.cashbook (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'in' or 'out'
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'General',
    payment_mode TEXT DEFAULT 'Cash',
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Team Invites Table
CREATE TABLE IF NOT EXISTS public.team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.business_profile(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer', -- 'admin', 'accountant', 'viewer', or custom role name
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(owner_id, email)
);

-- 12. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    custom_role_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Custom Roles & Permissions Table
CREATE TABLE IF NOT EXISTS public.custom_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_id UUID REFERENCES public.business_profile(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. AppSumo / License Codes Table
CREATE TABLE IF NOT EXISTS public.appsumo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by TEXT,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ====================================================================
-- STORED PROCEDURES & RPC FUNCTIONS
-- ====================================================================

-- RPC Function: Create Invoice along with line items & auto stock adjustment
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
    invoice_data JSONB,
    items_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_invoice_id UUID;
    item_record JSONB;
    created_invoice RECORD;
    stock_delta NUMERIC;
BEGIN
    -- Insert Main Invoice
    INSERT INTO public.invoices (
        business_id, user_id, invoice_no, type, document_kind,
        customer_id, warehouse_id, reference_invoice_id, date, due_date,
        status, subtotal, gst_amount, discount, round_off, shipping_charges,
        state_of_supply, total, paid, balance, notes, last_payment_mode, last_payment_at
    ) VALUES (
        (invoice_data->>'business_id')::UUID,
        (invoice_data->>'user_id')::UUID,
        invoice_data->>'invoice_no',
        COALESCE(invoice_data->>'type', 'sale'),
        COALESCE(invoice_data->>'document_kind', 'sale_invoice'),
        (invoice_data->>'customer_id')::UUID,
        (invoice_data->>'warehouse_id')::UUID,
        (invoice_data->>'reference_invoice_id')::UUID,
        (invoice_data->>'date')::DATE,
        (invoice_data->>'due_date')::DATE,
        COALESCE(invoice_data->>'status', 'unpaid'),
        COALESCE((invoice_data->>'subtotal')::NUMERIC, 0),
        COALESCE((invoice_data->>'gst_amount')::NUMERIC, 0),
        COALESCE((invoice_data->>'discount')::NUMERIC, 0),
        COALESCE((invoice_data->>'round_off')::NUMERIC, 0),
        COALESCE((invoice_data->>'shipping_charges')::NUMERIC, 0),
        invoice_data->>'state_of_supply',
        COALESCE((invoice_data->>'total')::NUMERIC, 0),
        COALESCE((invoice_data->>'paid')::NUMERIC, 0),
        COALESCE((invoice_data->>'balance')::NUMERIC, 0),
        invoice_data->>'notes',
        invoice_data->>'last_payment_mode',
        (invoice_data->>'last_payment_at')::TIMESTAMP WITH TIME ZONE
    )
    RETURNING * INTO created_invoice;

    new_invoice_id := created_invoice.id;

    -- Insert Items & Update Inventory Stock
    FOR item_record IN SELECT * FROM jsonb_array_elements(items_data)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id, product_id, name, hsn, qty, unit, price, discount, gst, amount
        ) VALUES (
            new_invoice_id,
            (item_record->>'product_id')::UUID,
            item_record->>'name',
            item_record->>'hsn',
            COALESCE((item_record->>'qty')::NUMERIC, 1),
            COALESCE(item_record->>'unit', 'Pcs'),
            COALESCE((item_record->>'price')::NUMERIC, 0),
            COALESCE((item_record->>'discount')::NUMERIC, 0),
            COALESCE((item_record->>'gst')::NUMERIC, 18),
            COALESCE((item_record->>'amount')::NUMERIC, 0)
        );

        -- Auto Stock Adjustment: Decrease stock on sale_invoice, Increase on purchase_bill
        IF (item_record->>'product_id') IS NOT NULL AND (item_record->>'product_id') != '' THEN
            IF created_invoice.document_kind = 'sale_invoice' THEN
                stock_delta := -1 * COALESCE((item_record->>'qty')::NUMERIC, 0);
            ELSIF created_invoice.document_kind = 'purchase_bill' THEN
                stock_delta := COALESCE((item_record->>'qty')::NUMERIC, 0);
            ELSE
                stock_delta := 0;
            END IF;

            IF stock_delta != 0 THEN
                UPDATE public.products 
                SET stock = stock + stock_delta 
                WHERE id = (item_record->>'product_id')::UUID;
            END IF;
        END IF;
    END LOOP;

    RETURN to_jsonb(created_invoice);
END;
$$;

-- RPC Function: Get Customer Total Outstanding Balance
CREATE OR REPLACE FUNCTION public.get_customer_outstanding(customer_uuid UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_balance NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(balance), 0)
    INTO total_balance
    FROM public.invoices
    WHERE customer_id = customer_uuid
      AND status IN ('unpaid', 'partial', 'overdue');
      
    RETURN total_balance;
END;
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appsumo_codes ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for SaaS Multi-tenancy
CREATE POLICY "Allow authenticated read/write on business_profile" ON public.business_profile FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on customers" ON public.customers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on products" ON public.products FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on invoices" ON public.invoices FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on invoice_items" ON public.invoice_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on expenses" ON public.expenses FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on team_invites" ON public.team_invites FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated read/write on appsumo_codes" ON public.appsumo_codes FOR ALL USING (auth.uid() IS NOT NULL);
