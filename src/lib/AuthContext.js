// src/lib/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from './supabase';

const AuthContext = createContext({});

async function ensureBusinessProfile(user) {
  if (!supabase || !user?.id) return;
  const businessName = user.user_metadata?.business_name?.trim();
  const phone = user.user_metadata?.phone?.trim() || null;
  const email = user.email || null;
  const { data: existing, error } = await supabase
    .from('business_profile')
    .select('id, business_name, email, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return;

  if (!existing) {
    await supabase.from('business_profile').insert([{
      user_id: user.id,
      business_name: businessName || null,
      email,
      phone,
    }]);
    return;
  }

  const updates = {};
  if (!existing.business_name && businessName) updates.business_name = businessName;
  if (!existing.email && email) updates.email = email;
  if (!existing.phone && phone) updates.phone = phone;
  if (Object.keys(updates).length > 0) {
    await supabase.from('business_profile').update(updates).eq('user_id', user.id);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) ensureBusinessProfile(session.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) ensureBusinessProfile(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signUp = (email, password, businessName, phone) => {
    if (!supabase) return Promise.resolve({ data: null, error: new Error(supabaseConfigError) });
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName?.trim() || '',
          phone: phone?.trim() || '',
        },
      },
    });
  };
  const signIn = (email, password) => (
    !supabase
      ? Promise.resolve({ data: null, error: new Error(supabaseConfigError) })
      : supabase.auth.signInWithPassword({ email, password })
  );
  const signOut = () => (
    !supabase
      ? Promise.resolve({ error: new Error(supabaseConfigError) })
      : supabase.auth.signOut()
  );

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
