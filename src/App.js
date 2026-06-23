import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import { supabase, supabaseConfigError } from './db';
import { RoleProvider, useRole } from './lib/RoleContext';
import { BusinessProvider } from './lib/BusinessContext';
import { ThemeProvider } from './lib/ThemeContext';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Payments from './pages/Payments';
import Products from './pages/Products';
import Purchases from './pages/Purchases';
import Quotations from './pages/Quotations';
import Estimates from './pages/Estimates';
import Proforma from './pages/Proforma';
import DeliveryChallans from './pages/DeliveryChallans';
import CreditNotes from './pages/CreditNotes';
import DebitNotes from './pages/DebitNotes';
import PartyLedger from './pages/PartyLedger';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Team from './pages/Team';
import DataMigration from './pages/DataMigration';
import Security from './pages/Security';
import PurchaseReturns from './pages/PurchaseReturns';
import Inventory from './pages/Inventory';
import Accounting from './pages/Accounting';

function ProtectedRoute({ element, requiredRole }) {
  const { hasPermission, loading } = useRole();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!hasPermission(requiredRole)) return <Navigate to="/dashboard" replace />;
  return element;
}

function AppShell() {
  const { loading } = useRole();
  if (loading) return <div className="loading-screen">Loading...</div>;

  const V = (el) => <ProtectedRoute element={el} requiredRole="viewer" />;
  const A = (el) => <ProtectedRoute element={el} requiredRole="accountant" />;
  const D = (el) => <ProtectedRoute element={el} requiredRole="admin" />;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoices" element={V(<Invoices />)} />
          <Route path="/invoices/:id" element={V(<InvoiceDetail />)} />
          <Route path="/quotations" element={V(<Quotations />)} />
          <Route path="/quotations/:id" element={V(<InvoiceDetail />)} />
          <Route path="/estimates" element={V(<Estimates />)} />
          <Route path="/estimates/:id" element={V(<InvoiceDetail />)} />
          <Route path="/proforma" element={V(<Proforma />)} />
          <Route path="/proforma/:id" element={V(<InvoiceDetail />)} />
          <Route path="/delivery-challans" element={V(<DeliveryChallans />)} />
          <Route path="/delivery-challans/:id" element={V(<InvoiceDetail />)} />
          <Route path="/credit-notes" element={V(<CreditNotes />)} />
          <Route path="/credit-notes/:id" element={V(<InvoiceDetail />)} />
          <Route path="/purchases" element={V(<Purchases />)} />
          <Route path="/purchases/:id" element={V(<InvoiceDetail />)} />
          <Route path="/debit-notes" element={V(<DebitNotes />)} />
          <Route path="/debit-notes/:id" element={V(<InvoiceDetail />)} />
          <Route path="/purchase-returns" element={V(<PurchaseReturns />)} />
          <Route path="/purchase-returns/:id" element={V(<InvoiceDetail />)} />
          <Route path="/customers" element={V(<Customers />)} />
          <Route path="/ledger/:partyId" element={V(<PartyLedger />)} />
          <Route path="/products" element={V(<Products />)} />
          <Route path="/inventory" element={V(<Inventory />)} />
          <Route path="/expenses" element={V(<Expenses />)} />
          <Route path="/reports" element={V(<Reports />)} />
          <Route path="/accounting" element={A(<Accounting />)} />
          <Route path="/payments" element={A(<Payments />)} />
          <Route path="/settings" element={A(<Settings />)} />
          <Route path="/team" element={D(<Team />)} />
          <Route path="/security" element={D(<Security />)} />
          <Route path="/migration" element={A(<DataMigration />)} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined; }
    supabase.auth.getSession().then(({ data: { session: s } }) => { setSession(s); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return undefined;
    
    let timeoutId;
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
    
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        supabase.auth.signOut();
        alert('You have been logged out due to inactivity.');
      }, INACTIVITY_TIMEOUT);
    };
    
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    
    resetTimer();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [session]);

  if (authLoading) return <div className="loading-screen">Loading...</div>;

  return (
    <Router>
      {session ? (
        <ThemeProvider>
          <RoleProvider>
            <BusinessProvider>
              <AppShell />
            </BusinessProvider>
          </RoleProvider>
        </ThemeProvider>
      ) : (
        <>
          {supabaseConfigError && <div className="config-banner">{supabaseConfigError}</div>}
          <Auth />
        </>
      )}
    </Router>
  );
}

export default App;
