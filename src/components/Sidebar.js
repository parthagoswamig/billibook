import React from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../db';
import { useRole } from '../lib/RoleContext';
import { useUser } from '../lib/useUser';
import AddBusinessModal from './AddBusinessModal';

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
  const { userRole, tenantId, accessibleBusinesses, switchBusiness, acceptInvite, canManageUsers, checkPermission } = useRole();
  const { user } = useUser();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [addBusinessModalOpen, setAddBusinessModalOpen] = React.useState(false);
  const levels = { admin: 3, accountant: 2, viewer: 1 };
  const ok = (role) => (levels[userRole] || 0) >= (levels[role] || 0);

  const activeBusiness = accessibleBusinesses.find(b => b.tenant_id === tenantId) || { business_name: 'Loading Business...' };
  const acceptedBusinesses = accessibleBusinesses.filter(b => b.status === 'accepted');
  const pendingBusinesses = accessibleBusinesses.filter(b => b.status === 'pending');

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

      <div className="sidebar-business-selector" style={{ padding: '0 16px', marginBottom: '16px', position: 'relative' }}>
        <div 
          onClick={() => setDropdownOpen(!dropdownOpen)} 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '8px', 
            padding: '10px 12px', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          className="business-selector-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '18px' }}>🏢</span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ 
                fontWeight: '700', 
                color: '#fff', 
                fontSize: '13px', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {activeBusiness.business_name}
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                {activeBusiness.is_owner ? 'Owner' : activeBusiness.role}
              </span>
            </div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>{dropdownOpen ? '▲' : '▼'}</span>
        </div>

        {dropdownOpen && (
          <div 
            style={{ 
              position: 'absolute', 
              top: '100%', 
              left: '16px', 
              right: '16px', 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '8px', 
              zIndex: 100, 
              marginTop: '4px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              maxHeight: '260px',
              overflowY: 'auto'
            }}
          >
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '700', textTransform: 'uppercase' }}>
              My Businesses
            </div>
            {acceptedBusinesses.map(b => (
              <div 
                key={b.tenant_id}
                onClick={() => { switchBusiness(b.tenant_id); setDropdownOpen(false); }}
                style={{ 
                  padding: '10px 12px', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: b.tenant_id === tenantId ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  transition: 'background 0.2s'
                }}
                className="business-dropdown-item"
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                  <div style={{ color: '#fff', fontSize: '12.5px', fontWeight: b.tenant_id === tenantId ? '700' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.business_name}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                    {b.is_owner ? 'Owner' : b.role}
                  </div>
                </div>
                {b.tenant_id === tenantId && <span style={{ color: '#10B981', fontSize: '12px' }}>✓</span>}
              </div>
            ))}

            {pendingBusinesses.length > 0 && (
              <>
                <div style={{ padding: '8px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Invites & Requests
                </div>
                {pendingBusinesses.map(b => (
                  <div 
                    key={b.tenant_id}
                    style={{ 
                      padding: '10px 12px', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div>
                      <div style={{ color: '#fff', fontSize: '12.5px', fontWeight: '500' }}>
                        {b.business_name}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.5)' }}>
                        Invited as: <span style={{ textTransform: 'capitalize' }}>{b.role}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { acceptInvite(b.tenant_id, user.email); setDropdownOpen(false); }}
                      style={{ 
                        background: '#10B981', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '4px', 
                        padding: '6px 10px', 
                        fontSize: '11px', 
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        textAlign: 'center'
                      }}
                      type="button"
                    >
                      🤝 Accept & Join
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Add New Business Button */}
            <div 
              onClick={() => {
                setDropdownOpen(false);
                setAddBusinessModalOpen(true);
              }}
              style={{
                padding: '12px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                color: '#3b82f6',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              className="business-dropdown-item"
            >
              <span>+</span> Add New Business
            </div>
          </div>
        )}
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
          <nav className="sidebar-nav">
            {mainLinks.map(link)}
            {user?.email?.toLowerCase().trim() === 'parthagoswamig@gmail.com' && (
              <NavLink 
                to="/super-admin" 
                className={({ isActive }) => isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">👑</span>
                <span className="sidebar-link-text">Super Admin</span>
              </NavLink>
            )}
          </nav>
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

      <AddBusinessModal 
        isOpen={addBusinessModalOpen} 
        onClose={() => setAddBusinessModalOpen(false)} 
        currentEmail={user?.email} 
      />
    </aside>
  );
}

export default Sidebar;
