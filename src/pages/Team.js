import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { useRole } from '../lib/RoleContext';
import { 
  getTeamInvites, 
  inviteTeamMember, 
  getUserRole, 
  deleteTeamInvite,
  getCustomRoles,
  createCustomRole,
  deleteCustomRole,
  updateCustomRolePermissions
} from '../lib/db';
import './Team.css';

const MODULES = ['invoices', 'products', 'customers', 'expenses', 'accounting'];

function Team() {
  const { userId, loading: userLoading } = useUser();
  const { canCreate, tenantId } = useRole();
  const [invites, setInvites] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  
  // Tabs
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'roles'

  // Forms states
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer' });
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Matrix permissions state for creating or editing
  const [matrixPermissions, setMatrixPermissions] = useState({
    invoices: { can_read: true, can_write: false, can_delete: false },
    products: { can_read: true, can_write: false, can_delete: false },
    customers: { can_read: true, can_write: false, can_delete: false },
    expenses: { can_read: true, can_write: false, can_delete: false },
    accounting: { can_read: true, can_write: false, can_delete: false }
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [inv, role, croles] = await Promise.all([
        getTeamInvites(tenantId),
        getUserRole(tenantId),
        getCustomRoles(tenantId)
      ]);
      setInvites(inv || []);
      setUserRole(role);
      setCustomRoles(croles || []);
      if (croles && croles.length > 0 && !selectedRole) {
        setSelectedRole(croles[0]);
        initializePermissions(croles[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const initializePermissions = (roleObj) => {
    const permissions = {
      invoices: { can_read: true, can_write: false, can_delete: false },
      products: { can_read: true, can_write: false, can_delete: false },
      customers: { can_read: true, can_write: false, can_delete: false },
      expenses: { can_read: true, can_write: false, can_delete: false },
      accounting: { can_read: true, can_write: false, can_delete: false }
    };
    if (roleObj && roleObj.custom_permissions) {
      roleObj.custom_permissions.forEach((p) => {
        if (permissions[p.module_name]) {
          permissions[p.module_name] = {
            can_read: p.can_read,
            can_write: p.can_write,
            can_delete: p.can_delete
          };
        }
      });
    }
    setMatrixPermissions(permissions);
  };

  const handleSelectRole = (roleObj) => {
    setSelectedRole(roleObj);
    initializePermissions(roleObj);
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email) return;
    try {
      setError('');
      await inviteTeamMember(tenantId, inviteForm.email, inviteForm.role);
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'viewer' });
      setMessage('✓ Invite sent. User will get the role when they sign up with this email.');
      setTimeout(() => setMessage(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateRoleSubmit = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      setError('');
      const defaultPerms = {
        invoices: { can_read: true, can_write: false, can_delete: false },
        products: { can_read: true, can_write: false, can_delete: false },
        customers: { can_read: true, can_write: false, can_delete: false },
        expenses: { can_read: true, can_write: false, can_delete: false },
        accounting: { can_read: true, can_write: false, can_delete: false }
      };
      await createCustomRole(tenantId, newRoleName, defaultPerms);
      setNewRoleName('');
      setShowRoleModal(false);
      setMessage('✓ Custom role created successfully');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this custom role? Users assigned to this role will lose their custom permissions.')) return;
    try {
      setError('');
      await deleteCustomRole(roleId);
      setMessage('✓ Custom role deleted successfully');
      setTimeout(() => setMessage(''), 3000);
      setSelectedRole(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCheckboxChange = (module, permType, value) => {
    setMatrixPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [permType]: value
      }
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      setError('');
      await updateCustomRolePermissions(selectedRole.id, tenantId, matrixPermissions);
      setMessage('✓ Role permissions matrix updated successfully');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="team-container" style={{ padding: '0 24px' }}>
        {/* Title Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>👥 Team & Security Matrix</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Invite team members and configure advanced custom role permission policies.
            </p>
          </div>
          {activeTab === 'members' && userRole === 'admin' && (
            <button className="primary-button" type="button" onClick={() => { setShowInviteModal(true); setError(''); }}>
              + Invite Member
            </button>
          )}
          {activeTab === 'roles' && userRole === 'admin' && (
            <button className="primary-button" type="button" onClick={() => { setShowRoleModal(true); setError(''); }}>
              + Create Custom Role
            </button>
          )}
        </div>

        {message && <p className="form-message form-success" style={{ marginBottom: '20px' }}>{message}</p>}
        {error && <p className="form-message form-error" style={{ marginBottom: '20px' }}>{error}</p>}

        {/* Tab Selection */}
        <div className="inventory-tabs" style={{ marginBottom: '20px' }}>
          <button className={`inventory-tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
            👥 Team Members
          </button>
          <button className={`inventory-tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
            🛡️ Role Permissions Matrix
          </button>
        </div>

        {loading || userLoading ? (
          <div className="empty-state">Loading team console...</div>
        ) : (
          <>
            {/* Team Members List */}
            {activeTab === 'members' && (
              <>
                <div className="team-info-card" style={{ padding: '16px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Your role: <span className="role-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{userRole}</span></p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Built-in roles: Admin (full access) · Accountant (financial entry only) · Viewer (read only)</p>
                </div>

                {invites.length === 0 ? (
                  <div className="empty-state">No team invites yet. Invite team members by email.</div>
                ) : (
                  <div className="team-list" style={{ display: 'grid', gap: '12px' }}>
                    {invites.map((inv) => (
                      <div key={inv.id} className="team-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div>
                          <p style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text-primary)' }}>{inv.email}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Role: <strong style={{ textTransform: 'capitalize' }}>{inv.role}</strong> · Status: {inv.status}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span className={`status-badge status-${inv.status}`} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: inv.status === 'accepted' ? '#D1FAE5' : '#FEF3C7', color: inv.status === 'accepted' ? '#065F46' : '#92400E' }}>{inv.status}</span>
                          {inv.status === 'pending' && userRole === 'admin' && (
                            <button className="secondary-button" style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', padding: '6px 12px', fontSize: '12px' }} type="button" onClick={async () => { await deleteTeamInvite(inv.id); load(); }}>Revoke</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Custom Role Matrix Editor */}
            {activeTab === 'roles' && (
              <div className="split-layout">
                {/* Roles Side Panel */}
                <div className="inventory-card" style={{ flex: 1 }}>
                  <h3>Custom Roles</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Select a custom role to configure its granular permission grid.</p>
                  
                  {customRoles.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No custom roles defined. Click "+ Create Custom Role" above.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {customRoles.map(cr => (
                        <div 
                          key={cr.id}
                          onClick={() => handleSelectRole(cr)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: selectedRole?.id === cr.id ? 'var(--accent)' : 'var(--border)',
                            background: selectedRole?.id === cr.id ? 'var(--accent-light)' : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontWeight: '600', color: selectedRole?.id === cr.id ? 'var(--accent-dark)' : 'var(--text-primary)' }}>{cr.name}</span>
                          {userRole === 'admin' && (
                            <button 
                              type="button" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteRole(cr.id); }}
                              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                            >
                              ✕ Delete
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Permissions Matrix Grid Panel */}
                <div className="inventory-card" style={{ flex: 2.2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3>Granular Permissions Matrix</h3>
                    {selectedRole && userRole === 'admin' && (
                      <button 
                        type="button"
                        className="primary-button"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                        onClick={handleSavePermissions}
                      >
                        💾 Save Permissions
                      </button>
                    )}
                  </div>

                  {selectedRole ? (
                    <div>
                      <h4 style={{ marginBottom: '16px' }}>Active Role: <span style={{ color: 'var(--accent)' }}>{selectedRole.name}</span></h4>
                      <table className="spreadsheet-table" style={{ fontSize: '13.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ width: '40%' }}>Module / Feature</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Read (View)</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Write (Create/Edit)</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Delete</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MODULES.map(mod => {
                            const perms = matrixPermissions[mod] || { can_read: true, can_write: false, can_delete: false };
                            return (
                              <tr key={mod}>
                                <td style={{ textTransform: 'capitalize', fontWeight: '600' }}>{mod}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={perms.can_read} 
                                    onChange={(e) => handleCheckboxChange(mod, 'can_read', e.target.checked)}
                                    disabled={userRole !== 'admin'}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={perms.can_write} 
                                    onChange={(e) => handleCheckboxChange(mod, 'can_write', e.target.checked)}
                                    disabled={userRole !== 'admin'}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={perms.can_delete} 
                                    onChange={(e) => handleCheckboxChange(mod, 'can_delete', e.target.checked)}
                                    disabled={userRole !== 'admin'}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-logs" style={{ padding: '40px' }}>Please select or create a custom role from the left panel.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Modal Pop */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invite Team Member</h3>
              <button className="modal-close" type="button" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <form onSubmit={handleInviteSubmit} className="modal-form">
              <label className="form-label">
                <span>Email Address *</span>
                <input 
                  type="email" 
                  className="form-input" 
                  value={inviteForm.email} 
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} 
                  required 
                />
              </label>
              
              <label className="form-label">
                <span>Assign Role *</span>
                <select 
                  className="form-input" 
                  value={inviteForm.role} 
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                >
                  <option value="viewer">Viewer (Built-in)</option>
                  <option value="accountant">Accountant (Built-in)</option>
                  <option value="admin">Admin (Built-in)</option>
                  {customRoles.map(cr => (
                    <option key={cr.id} value={cr.name}>{cr.name} (Custom)</option>
                  ))}
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Custom Role Modal Pop */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Custom Role</h3>
              <button className="modal-close" type="button" onClick={() => setShowRoleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRoleSubmit} className="modal-form">
              <label className="form-label">
                <span>Role Name *</span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Sales Manager, Inventory Clerk"
                  value={newRoleName} 
                  onChange={(e) => setNewRoleName(e.target.value)} 
                  required 
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowRoleModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">Create Role</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Team;
