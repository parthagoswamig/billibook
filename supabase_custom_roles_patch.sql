-- =================================================================
-- myBillBook Clone — Team & Security Custom Roles Table Patch
-- Fixes "Could not find the table 'public.custom_roles' in the schema cache"
-- Paste and Run this inside your Supabase Dashboard SQL Editor
-- =================================================================

-- 1. Create custom_roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

-- 2. Create custom_permissions table
CREATE TABLE IF NOT EXISTS public.custom_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES public.custom_roles(id) ON DELETE CASCADE NOT NULL,
  module_name text NOT NULL, -- 'invoices', 'products', 'customers', 'expenses', etc.
  can_read boolean DEFAULT true,
  can_write boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role_id, module_name)
);

-- 3. Enable RLS on both tables
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Setup policies for custom_roles
DROP POLICY IF EXISTS "own custom_roles select" ON public.custom_roles;
DROP POLICY IF EXISTS "own custom_roles insert" ON public.custom_roles;
DROP POLICY IF EXISTS "own custom_roles update" ON public.custom_roles;
DROP POLICY IF EXISTS "own custom_roles delete" ON public.custom_roles;

CREATE POLICY "own custom_roles select" ON public.custom_roles FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own custom_roles insert" ON public.custom_roles FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "own custom_roles update" ON public.custom_roles FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "own custom_roles delete" ON public.custom_roles FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');

-- 5. Setup policies for custom_permissions
DROP POLICY IF EXISTS "own permissions select" ON public.custom_permissions;
DROP POLICY IF EXISTS "own permissions insert" ON public.custom_permissions;
DROP POLICY IF EXISTS "own permissions update" ON public.custom_permissions;
DROP POLICY IF EXISTS "own permissions delete" ON public.custom_permissions;

CREATE POLICY "own permissions select" ON public.custom_permissions FOR SELECT
  USING (user_id = public.get_tenant_id(auth.uid()));
CREATE POLICY "own permissions insert" ON public.custom_permissions FOR INSERT
  WITH CHECK (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "own permissions update" ON public.custom_permissions FOR UPDATE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "own permissions delete" ON public.custom_permissions FOR DELETE
  USING (user_id = public.get_tenant_id(auth.uid()) AND public.get_user_role(auth.uid()) = 'admin');

-- 6. Link custom_roles to user_roles table
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;
