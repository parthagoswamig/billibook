import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from './useUser';
import { getUserRole, ensureUserRole, getTenantId, getCustomPermissionsForUser, getAccessibleBusinesses, acceptBusinessInvite, getActiveRole } from './db';

const RoleContext = createContext();

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used within RoleProvider');
  return context;
};

export function RoleProvider({ children }) {
  const { userId } = useUser();
  const [userRole, setUserRole] = useState('viewer');
  const [tenantId, setTenantId] = useState(null);
  const [customPermissions, setCustomPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const moduleAliases = {
    payments: 'accounting',
    reports: 'accounting',
    migration: 'accounting',
    settings: 'accounting',
    purchases: 'invoices',
    inventory: 'products',
    party_ledger: 'customers',
  };

  const resolveModule = (module) => moduleAliases[module] || module;

  const inferModuleFromPath = () => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname || '';
    if (path.startsWith('/customers') || path.startsWith('/ledger/')) return 'customers';
    if (path.startsWith('/products') || path.startsWith('/inventory')) return 'products';
    if (path.startsWith('/expenses')) return 'expenses';
    if (
      path.startsWith('/invoices') ||
      path.startsWith('/quotations') ||
      path.startsWith('/estimates') ||
      path.startsWith('/proforma') ||
      path.startsWith('/delivery-challans') ||
      path.startsWith('/credit-notes') ||
      path.startsWith('/purchases') ||
      path.startsWith('/debit-notes') ||
      path.startsWith('/purchase-returns')
    ) return 'invoices';
    if (
      path.startsWith('/reports') ||
      path.startsWith('/accounting') ||
      path.startsWith('/payments') ||
      path.startsWith('/migration')
    ) return 'accounting';
    return null;
  };

  const [accessibleBusinesses, setAccessibleBusinesses] = useState([]);
  const [businessRefreshTrigger, setBusinessRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchRoleAndBusinesses = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        await ensureUserRole(userId, 'viewer');
        const tId = await getTenantId(userId);
        setTenantId(tId);
        
        const role = await getActiveRole(userId, tId);
        setUserRole(role);
        
        setCustomPermissions({});
        if (role === 'custom') {
          const perms = await getCustomPermissionsForUser(userId);
          const permMap = {};
          if (perms) {
            perms.forEach(p => {
              permMap[p.module_name] = {
                read: p.can_read,
                write: p.can_write,
                delete: p.can_delete
              };
            });
          }
          setCustomPermissions(permMap);
        }
        
        const list = await getAccessibleBusinesses();
        setAccessibleBusinesses(list);
      } catch (err) {
        console.error('Error fetching user role, defaulting to viewer:', err);
        setUserRole('viewer');
        setTenantId(userId);
      } finally {
        setLoading(false);
      }
    };
    fetchRoleAndBusinesses();
  }, [userId, businessRefreshTrigger]);

  const switchBusiness = (newTenantId) => {
    localStorage.setItem('khatape_active_tenant_id', newTenantId);
    setBusinessRefreshTrigger(prev => prev + 1);
  };

  const acceptInvite = async (ownerId, email) => {
    await acceptBusinessInvite(ownerId, email);
    switchBusiness(ownerId);
  };

  const roleHierarchy = { admin: 3, accountant: 2, viewer: 1 };
  const hasPermission = (requiredRole) => {
    if (userRole === 'admin') return true;
    if (userRole === 'custom') {
      // Custom roles can access viewer or accountant features if allowed by their matrix
      if (requiredRole === 'viewer') return true; 
      return false; // For raw hierarchy checks, default custom roles below accountant
    }
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
  };

  const hasModulePermission = (module, action = 'view') => {
    const resolvedModule = resolveModule(module);
    if (!resolvedModule) return false;
    if (userRole === 'admin') return true;
    if (userRole === 'custom') {
      const perms = customPermissions[resolvedModule];
      if (!perms) return false;
      if (action === 'delete') return !!perms.delete;
      if (action === 'write' || action === 'create' || action === 'edit' || action === 'update') return !!perms.write;
      return !!perms.read;
    }
    if (userRole === 'accountant') {
      return resolvedModule !== 'security' && resolvedModule !== 'team_invites' && resolvedModule !== 'user_roles';
    }
    return action === 'view' || action === 'read';
  };

  const checkPermission = (action, entity) => {
    if (userRole === 'admin') {
      return true;
    }
    if (userRole === 'viewer') {
      return action === 'read' || action === 'view';
    }
    if (userRole === 'accountant') {
      if (entity === 'users' || entity === 'user_roles' || entity === 'team_invites' || entity === 'security') {
        return action === 'read' || action === 'view';
      }
      return true;
    }
    if (userRole === 'custom') {
      if (entity === 'users' || entity === 'user_roles' || entity === 'team_invites' || entity === 'security') {
        return false;
      }
      return hasModulePermission(entity, action);
    }
    return false;
  };

  return (
    <RoleContext.Provider value={{
      userRole,
      tenantId,
      customPermissions,
      loading,
      accessibleBusinesses,
      switchBusiness,
      acceptInvite,
      refreshBusinesses: () => setBusinessRefreshTrigger(prev => prev + 1),
      hasPermission,
      hasModulePermission,
      checkPermission,
      canCreate: (module) => {
        if (module) return hasModulePermission(module, 'write');
        if (userRole === 'custom') return hasModulePermission(inferModuleFromPath(), 'write');
        return hasPermission('accountant');
      },
      canEdit: (module) => {
        if (module) return hasModulePermission(module, 'write');
        if (userRole === 'custom') return hasModulePermission(inferModuleFromPath(), 'write');
        return hasPermission('accountant');
      },
      canDelete: (module) => {
        if (module) return hasModulePermission(module, 'delete');
        if (userRole === 'custom') return hasModulePermission(inferModuleFromPath(), 'delete');
        return hasPermission('accountant');
      },
      canViewReports: () => userRole === 'admin' || userRole === 'accountant' || userRole === 'viewer' || (userRole === 'custom' && !!customPermissions['accounting']?.read),
      canManageUsers: () => hasPermission('admin'),
    }}>
      {children}
    </RoleContext.Provider>
  );
}
