import React from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../db';
import { useRole } from '../lib/RoleContext';
import { useUser } from '../lib/useUser';

const salesLinks = [
  { to: '/invoices', label: '📄 Sales Invoice', role: 'viewer', module: 'invoices' },
  { to: '/quotations', label: '📝 Quotation', role: 'viewer', module: 'invoices' },
  { to: '/estimates', label: '📋 Estimate', role: 'viewer', module: 'invoices' },
  { to: '/proforma', label: '📑 Proforma', role: 'viewer', module: 'invoices' },
  { to: '/delivery-challans', label: '🚚 Delivery Challan', role: 'viewer', module: 'invoices' },
  { to: '/credit-notes', label: '↩️ Credit Note', role: 'viewer', module: 'invoices' },
];

const purchaseLinks = [
  { to: '/purchases', label: '🛒 Purchase Bill', role: 'viewer', module: 'invoices' },
  { to: '/purchase-returns', label: '🔄 Purchase Return', role: 'viewer', module: 'invoices' },
  { to: '/debit-notes', label: '↪️ Debit Note', role: 'viewer', module: 'invoices' },
];

const mainLinks = [
  { to: '/dashboard', label: '📊 Dashboard', role: 'viewer' },
  { to: '/customers', label: '👥 Parties', role: 'viewer', module: 'customers' },
  { to: '/products', label: '📦 Products', role: 'viewer', module: 'products' },
  { to: '/inventory', label: '🏬 Inventory', role: 'viewer', module: 'products' },
  { to: '/expenses', label: '💰 Expenses', role: 'viewer', module: 'expenses' },
];

const accountingLinks = [
  { to: '/payments', label: '💳 Payments', role: 'accountant', module: 'invoices' },
  { to: '/accounting', label: '🏦 Accounting Books', role: 'accountant', module: 'accounting' },
  { to: '/migration', label: '🔄 Migration', role: 'accountant', module: 'accounting' },
  { to: '/reports', label: '📈 Reports & GST', role: 'viewer', module: 'accounting' },
  { to: '/settings', label: '⚙️ Settings', role: 'accountant', module: 'accounting' },
];

function Sidebar({ onClose }) {
  const { userRole, canManageUsers, checkPermission } = useRole();
  const { user } = useUser();
  const levels = { admin: 3, accountant: 2, viewer: 1 };
  const ok = (role) => (levels[userRole] || 0) >= (levels[role] || 0);

  const getInitials = (email) => {
    if (!email) return 'U';
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  const canSeeLink = (l) => {
    if (l.module && userRole === 'custom') return checkPermission('read', l.module);
    return ok(l.role);
  };

  const link = (l) => canSeeLink(l) && (
    <NavLink 
      key={l.to} 
      to={l.to} 
      className={({ isActive }) => isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'}
      onClick={onClose}
    >
      <span className="sidebar-link-icon">{l.label.substring(0, 2)}</span>
      <span className="sidebar-link-text">{l.label.substring(2)}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header-wrapper">
        <div className="sidebar-logo-container">
          <img src="/logo.png" alt="KhataPe Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', marginRight: '8px' }} />
          <div className="sidebar-logo-text-wrapper">
            <span className="sidebar-logo-title">KhataPe</span>
            <span className="sidebar-logo-tagline">GST Billing</span>
          </div>
        </div>
      </div>

      <div className="sidebar-user-info">
        <div className="sidebar-user-avatar">
          {getInitials(user?.email)}
        </div>
        <div className="sidebar-user-details">
          <span className="sidebar-user-email">{user?.email || 'user@email.com'}</span>
          <span className="sidebar-user-role-badge">{userRole}</span>
        </div>
      </div>

      <div className="sidebar-scrollable-content">
        <div className="sidebar-section">
          <p className="sidebar-section-label">Main</p>
          <nav className="sidebar-nav">{mainLinks.map(link)}</nav>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-label">Sales</p>
          <nav className="sidebar-nav">{salesLinks.map(link)}</nav>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-label">Purchase</p>
          <nav className="sidebar-nav">{purchaseLinks.map(link)}</nav>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-label">Accounting</p>
          <nav className="sidebar-nav">{accountingLinks.map(link)}</nav>
        </div>

        {canManageUsers() && (
          <div className="sidebar-section">
            <p className="sidebar-section-label">Admin</p>
            <nav className="sidebar-nav">
              <NavLink 
                to="/team" 
                className={({ isActive }) => isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">👨‍💼</span>
                <span className="sidebar-link-text">Team</span>
              </NavLink>
              <NavLink 
                to="/security" 
                className={({ isActive }) => isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">🛡️</span>
                <span className="sidebar-link-text">Security</span>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      <div className="sidebar-footer-wrapper">
        <a href="/KhataPe.apk" download="KhataPe.apk" className="sidebar-download-app-btn">
          📱 Download App
        </a>
        <button className="sidebar-logout" onClick={() => { onClose?.(); supabase?.auth.signOut(); }} type="button">
          🚪 Log out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
