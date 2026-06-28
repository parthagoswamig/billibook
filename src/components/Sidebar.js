import React from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../db';
import { useRole } from '../lib/RoleContext';
import { useUser } from '../lib/useUser';

const salesLinks = [
  { to: '/invoices', label: '📄 Sales Invoice', role: 'viewer' },
  { to: '/quotations', label: '📝 Quotation', role: 'viewer' },
  { to: '/estimates', label: '📋 Estimate', role: 'viewer' },
  { to: '/proforma', label: '📑 Proforma', role: 'viewer' },
  { to: '/delivery-challans', label: '🚚 Delivery Challan', role: 'viewer' },
  { to: '/credit-notes', label: '↩️ Credit Note', role: 'viewer' },
];

const purchaseLinks = [
  { to: '/purchases', label: '🛒 Purchase Bill', role: 'viewer' },
  { to: '/purchase-returns', label: '🔄 Purchase Return', role: 'viewer' },
  { to: '/debit-notes', label: '↪️ Debit Note', role: 'viewer' },
];

const mainLinks = [
  { to: '/dashboard', label: '📊 Dashboard', role: 'viewer' },
  { to: '/customers', label: '👥 Parties', role: 'viewer' },
  { to: '/products', label: '📦 Products', role: 'viewer' },
  { to: '/inventory', label: '🏬 Inventory', role: 'viewer' },
  { to: '/expenses', label: '💰 Expenses', role: 'viewer' },
  { to: '/reports', label: '📈 Reports & GST', role: 'viewer' },
];

const accountingLinks = [
  { to: '/payments', label: '💳 Payments', role: 'accountant' },
  { to: '/accounting', label: '🏦 Accounting Books', role: 'accountant' },
  { to: '/migration', label: '🔄 Migration', role: 'accountant' },
  { to: '/settings', label: '⚙️ Settings', role: 'accountant' },
];

function Sidebar({ onClose }) {
  const { userRole, canManageUsers } = useRole();
  const { user } = useUser();
  const levels = { admin: 3, accountant: 2, viewer: 1 };
  const ok = (role) => (levels[userRole] || 0) >= (levels[role] || 0);

  const getInitials = (email) => {
    if (!email) return 'U';
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  const link = (l) => ok(l.role) && (
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
          <span className="sidebar-logo-icon">📒</span>
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

        {ok('accountant') && (
          <div className="sidebar-section">
            <p className="sidebar-section-label">Accounting</p>
            <nav className="sidebar-nav">{accountingLinks.map(link)}</nav>
          </div>
        )}

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
