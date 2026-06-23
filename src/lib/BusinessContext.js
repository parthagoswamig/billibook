import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRole } from './RoleContext';
import { getProfile } from './db';

const BusinessContext = createContext({ profile: null, currency: '₹' });

export function BusinessProvider({ children }) {
  const { tenantId } = useRole();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    getProfile(tenantId).then(setProfile).catch(() => {});
  }, [tenantId]);

  return (
    <BusinessContext.Provider value={{ profile, currency: profile?.currency_symbol || '₹', refresh: () => getProfile(tenantId).then(setProfile) }}>
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusiness = () => useContext(BusinessContext);
