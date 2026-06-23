import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from './useUser';
import { getUserRole, ensureUserRole, getTenantId } from './db';

const RoleContext = createContext();

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used within RoleProvider');
  return context;
};

export function RoleProvider({ children }) {
  const { userId } = useUser();
  const [userRole, setUserRole] = useState('admin');
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        await ensureUserRole(userId, 'admin');
        const role = await getUserRole(userId);
        setUserRole(role);
        const tId = await getTenantId(userId);
        setTenantId(tId);
      } catch {
        setUserRole('admin');
        setTenantId(userId);
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, [userId]);

  const roleHierarchy = { admin: 3, accountant: 2, viewer: 1 };
  const hasPermission = (requiredRole) => (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);

  const checkPermission = (action, entity) => {
    if (userRole === 'viewer') {
      return action === 'read' || action === 'view';
    }
    if (userRole === 'accountant') {
      if (entity === 'users' || entity === 'user_roles' || entity === 'team_invites' || entity === 'security') {
        return action === 'read' || action === 'view';
      }
      return true;
    }
    if (userRole === 'admin') {
      return true;
    }
    return false;
  };

  return (
    <RoleContext.Provider value={{
      userRole,
      tenantId,
      loading,
      hasPermission,
      checkPermission,
      canCreate: () => hasPermission('accountant'),
      canEdit: () => hasPermission('accountant'),
      canDelete: () => hasPermission('accountant'),
      canViewReports: () => hasPermission('viewer'),
      canManageUsers: () => hasPermission('admin'),
    }}>
      {children}
    </RoleContext.Provider>
  );
}
