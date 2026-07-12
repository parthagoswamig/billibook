import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import { supabase, supabaseConfigError } from './db';
import { RoleProvider, useRole } from './lib/RoleContext';
import { BusinessProvider } from './lib/BusinessContext';
import { ThemeProvider } from './lib/ThemeContext';
import { Toaster, toast } from 'react-hot-toast';
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
import { Browser } from '@capacitor/browser';
import Accounting from './pages/Accounting';
import { trackLogin } from './lib/visitTracker';

function ProtectedRoute({ element, requiredRole, module }) {
  const { hasPermission, hasModulePermission, loading, userRole } = useRole();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (userRole === 'custom' && module) {
    if (!hasModulePermission(module, 'view')) return <Navigate to="/dashboard" replace />;
    return element;
  }
  if (!hasPermission(requiredRole)) return <Navigate to="/dashboard" replace />;
  return element;
}

function AppShell() {
  const { loading } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return <div className="loading-screen">Loading...</div>;

  const V = (el) => <ProtectedRoute element={el} requiredRole="viewer" />;
  const A = (el) => <ProtectedRoute element={el} requiredRole="accountant" />;
  const D = (el) => <ProtectedRoute element={el} requiredRole="admin" />;

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Floating Toggle Hamburger Menu */}
      <button 
        className="mobile-sidebar-toggle" 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle Sidebar Menu"
      >
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>

      <Sidebar onClose={() => setSidebarOpen(false)} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoices" element={<ProtectedRoute element={<Invoices />} requiredRole="viewer" module="invoices" />} />
          <Route path="/invoices/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/quotations" element={<ProtectedRoute element={<Quotations />} requiredRole="viewer" module="invoices" />} />
          <Route path="/quotations/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/estimates" element={<ProtectedRoute element={<Estimates />} requiredRole="viewer" module="invoices" />} />
          <Route path="/estimates/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/proforma" element={<ProtectedRoute element={<Proforma />} requiredRole="viewer" module="invoices" />} />
          <Route path="/proforma/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/delivery-challans" element={<ProtectedRoute element={<DeliveryChallans />} requiredRole="viewer" module="invoices" />} />
          <Route path="/delivery-challans/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/credit-notes" element={<ProtectedRoute element={<CreditNotes />} requiredRole="viewer" module="invoices" />} />
          <Route path="/credit-notes/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/purchases" element={<ProtectedRoute element={<Purchases />} requiredRole="viewer" module="invoices" />} />
          <Route path="/purchases/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/debit-notes" element={<ProtectedRoute element={<DebitNotes />} requiredRole="viewer" module="invoices" />} />
          <Route path="/debit-notes/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/purchase-returns" element={<ProtectedRoute element={<PurchaseReturns />} requiredRole="viewer" module="invoices" />} />
          <Route path="/purchase-returns/:id" element={<ProtectedRoute element={<InvoiceDetail />} requiredRole="viewer" module="invoices" />} />
          <Route path="/customers" element={<ProtectedRoute element={<Customers />} requiredRole="viewer" module="customers" />} />
          <Route path="/ledger/:partyId" element={<ProtectedRoute element={<PartyLedger />} requiredRole="viewer" module="customers" />} />
          <Route path="/products" element={<ProtectedRoute element={<Products />} requiredRole="viewer" module="products" />} />
          <Route path="/inventory" element={<ProtectedRoute element={<Inventory />} requiredRole="viewer" module="products" />} />
          <Route path="/expenses" element={<ProtectedRoute element={<Expenses />} requiredRole="viewer" module="expenses" />} />
          <Route path="/reports" element={<ProtectedRoute element={<Reports />} requiredRole="viewer" module="accounting" />} />
          <Route path="/accounting" element={<ProtectedRoute element={<Accounting />} requiredRole="accountant" module="accounting" />} />
          <Route path="/payments" element={<ProtectedRoute element={<Payments />} requiredRole="accountant" module="accounting" />} />
          <Route path="/settings" element={A(<Settings />)} />
          <Route path="/team" element={D(<Team />)} />
          <Route path="/security" element={D(<Security />)} />
          <Route path="/migration" element={<ProtectedRoute element={<DataMigration />} requiredRole="accountant" module="accounting" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

const CURRENT_VERSION = "2.0.1";

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');
  const [onlineVersion, setOnlineVersion] = useState('');

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.version && data.version !== CURRENT_VERSION) {
          setOnlineVersion(data.version);
          setUpdateUrl(data.url || 'https://khatape360.vercel.app/KhataPe.apk');
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.warn('Update check failed:', err);
      }
    };
    checkUpdate();
  }, []);

  // Track unique user login — once per user per day (web & mobile app)
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined; }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
      // Mobile app: session restored from storage (INITIAL_SESSION doesn't always fire)
      if (s?.user?.id) trackLogin(s.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Track on: fresh login, mobile app opened (INITIAL_SESSION), token refresh (app resume)
      if (s?.user?.id && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        trackLogin(s.user.id); // trackLogin handles dedup — once per user per day
      }
      if (event === 'SIGNED_IN') {
        toast.success('Login Successful!', { 
          duration: 3000, 
          position: 'top-center',
          style: { fontWeight: '600', borderRadius: '10px' }
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkForUpdate() {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted || !data?.version) return;
        if (data.version !== CURRENT_VERSION) {
          setOnlineVersion(data.version);
          setUpdateUrl(data.url || '/KhataPe.apk');
          setUpdateAvailable(true);
        }
      } catch (_err) {
        // Ignore update lookup failures.
      }
    }

    checkForUpdate();
    return () => {
      isMounted = false;
    };
  }, []);


  if (authLoading) return <div className="loading-screen">Loading...</div>;

  return (
    <Router>
      <Toaster />
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

      {updateAvailable && (
        <div className="update-modal-overlay">
          <div className="update-modal-card">
            <span className="update-modal-icon">🚀</span>
            <h3>Update Available!</h3>
            <p>A new version of KhataPe (v{onlineVersion}) is available. Please update the application now to get the latest features and stability improvements.</p>
            <div className="update-modal-buttons">
              <button 
                className="update-btn primary-btn" 
                onClick={async () => {
                  setUpdateAvailable(false);
                  if (window.Capacitor) {
                    try {
                      await Browser.open({ url: updateUrl });
                    } catch (err) {
                      window.open(updateUrl, '_system');
                    }
                  } else {
                    window.open(updateUrl, '_blank');
                  }
                }}
              >
                Download & Install
              </button>
              <button className="update-btn secondary-btn" onClick={() => setUpdateAvailable(false)}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </Router>
  );
}

export default App;
