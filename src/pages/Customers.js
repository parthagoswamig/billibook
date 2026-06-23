import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSection from '../components/PageSection';
import SimpleTable from '../components/SimpleTable';
import Pagination from '../components/Pagination';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { getParties, addParty, updateParty, deleteParty, getPartyStats, bulkImportParties } from '../lib/db';
import { formatCurrency, exportToCSV, importFromCSV } from '../lib/utils';

function Customers() {
  const { userId, loading: userLoading } = useUser();
  const { currency } = useBusiness();
  const { canCreate, canEdit, canDelete, tenantId } = useRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState('customer');
  const [parties, setParties] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', gstin: '', state: '', city: '', pan: '', opening_balance: 0, opening_balance_type: 'Dr', credit_limit: 0 });
  const fmt = (n) => formatCurrency(n, currency);

  // Pagination & Search states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const limit = 50;

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [data, partyStats] = await Promise.all([
        getParties(tenantId, tab, page, limit, search),
        getPartyStats(tenantId)
      ]);
      setParties(data);
      setTotalCount(data.totalCount || 0);
      setStats(partyStats);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tenantId, tab, page, search]);

  const openAdd = () => { setEditId(null); setForm({ name: '', email: '', phone: '', address: '', gstin: '', state: '', city: '', pan: '', opening_balance: 0, opening_balance_type: 'Dr', credit_limit: 0 }); setShowModal(true); };
  const openEdit = (p) => { 
    setEditId(p.id); 
    setForm({ 
      name: p.name, email: p.email || '', phone: p.phone || '', address: p.address || '', 
      gstin: p.gstin || '', state: p.state || '', city: p.city || '', pan: p.pan || '', 
      opening_balance: p.opening_balance || 0,
      opening_balance_type: p.opening_balance_type || 'Dr',
      credit_limit: p.credit_limit || 0
    }); 
    setShowModal(true); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !form.name) return;
    if (editId && !canEdit()) return;
    if (!editId && !canCreate()) return;

    setError('');

    // Client-side duplicate check
    if (form.phone && form.phone.trim()) {
      const dupPhone = parties.find(p => p.id !== editId && p.phone && p.phone.trim() === form.phone.trim());
      if (dupPhone) {
        setError(`A ${tab} with this phone number already exists: ${dupPhone.name}`);
        return;
      }
    }
    if (form.gstin && form.gstin.trim()) {
      const dupGstin = parties.find(p => p.id !== editId && p.gstin && p.gstin.trim().toUpperCase() === form.gstin.trim().toUpperCase());
      if (dupGstin) {
        setError(`A ${tab} with this GSTIN already exists: ${dupGstin.name}`);
        return;
      }
    }

    try {
      if (editId) await updateParty(editId, { ...form, type: tab });
      else await addParty(tenantId, { ...form, type: tab });
      setShowModal(false);
      setMessage(editId ? '✓ Updated' : '✓ Added');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) { setError(err.message); }
  };

  const handleImport = async () => {
    if (!canCreate() || !tenantId) return;
    try {
      const data = await importFromCSV();
      if (!data || data.length === 0) {
        setError('No data found in CSV file');
        return;
      }
      await bulkImportParties(tenantId, data, tab);
      setMessage(`✓ Imported ${data.length} ${tab}s`);
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message || 'Failed to import data');
    }
  };

  return (
    <>
      <PageSection eyebrow="People" title={tab === 'customer' ? 'Customers' : 'Suppliers'} description="Manage parties, view ledger & outstanding."
        actions={
          <>
            <input 
              className="form-input search-input" 
              placeholder="Search..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              style={{ width: '180px', marginRight: '8px', display: 'inline-block' }}
            />
            {canCreate() && <button className="primary-button" type="button" onClick={openAdd}>+ Add</button>}
            {canCreate() && <button className="secondary-button" type="button" onClick={handleImport}>📤 Import CSV</button>}
            <button className="secondary-button" type="button" onClick={() => exportToCSV(`${tab}s.csv`, ['Name', 'Phone', 'Invoices', 'Outstanding Balance'], parties.map((p) => [p.name, p.phone, stats[p.id]?.count || 0, stats[p.id]?.outstanding || 0]))}>📥 CSV</button>
          </>
        }
      >
        <div className="filter-tabs" style={{ marginBottom: 20 }}>
          <button className={`filter-tab ${tab === 'customer' ? 'active' : ''}`} type="button" onClick={() => setTab('customer')}>👥 Customers</button>
          <button className={`filter-tab ${tab === 'supplier' ? 'active' : ''}`} type="button" onClick={() => setTab('supplier')}>🏭 Suppliers</button>
        </div>
        {message && <p className="form-message form-success">{message}</p>}
        {error && <p className="form-message form-error">{error}</p>}
        {loading || userLoading ? <div className="empty-state">Loading...</div> : parties.length === 0 ? <div className="empty-state">No records.</div> : (
          <>
            <SimpleTable columns={['Name', 'Phone', 'Invoices', 'Outstanding Balance']} rows={parties.map((p) => [p.name, p.phone || '—', stats[p.id]?.count || 0, fmt(stats[p.id]?.outstanding || 0)])} />
            <div className="table-actions-list">
              {parties.map((p) => (
                <div key={p.id} className="table-action-row">
                  <span>{p.name}</span>
                  <div className="row-actions">
                    <button className="action-button" type="button" onClick={() => navigate(`/ledger/${p.id}`)}>Ledger</button>
                    {canEdit() && <button className="action-button" type="button" onClick={() => openEdit(p)}>Edit</button>}
                    {canDelete() && <button className="action-button danger-btn" type="button" onClick={async () => { if (window.confirm('Delete?')) { await deleteParty(p.id); load(); } }}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
            <Pagination 
              page={page} 
              limit={limit} 
              totalCount={totalCount} 
              onChangePage={(p) => setPage(p)} 
            />
          </>
        )}
      </PageSection>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit' : 'Add'} {tab === 'customer' ? 'Customer' : 'Supplier'}</h3>
              <button className="modal-close" type="button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <label className="form-label"><span>Name *</span>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label className="form-label"><span>Phone / Mobile</span>
                  <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label"><span>Email Address</span>
                  <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label className="form-label"><span>GSTIN</span>
                  <input className="form-input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label"><span>City</span>
                  <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="form-label"><span>State</span>
                  <select 
                    className="form-input" 
                    value={form.state} 
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  >
                    <option value="">Select State</option>
                    {["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="form-label"><span>PAN Card Number</span>
                  <input className="form-input" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
                </label>
                <label className="form-label"><span>Opening Balance ({currency})</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" step="0.01" className="form-input" style={{ flex: 1 }} value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} />
                    <select className="form-input" style={{ width: '80px' }} value={form.opening_balance_type} onChange={(e) => setForm({ ...form, opening_balance_type: e.target.value })}>
                      <option value="Dr">Dr</option>
                      <option value="Cr">Cr</option>
                    </select>
                  </div>
                </label>
              </div>
              {tab === 'customer' && (
                <div className="form-row">
                  <label className="form-label"><span>Credit Limit ({currency})</span>
                    <input type="number" className="form-input" placeholder="0.00 (No Limit)" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
                  </label>
                  <div />
                </div>
              )}
              <label className="form-label"><span>Billing Address</span>
                <textarea className="form-input" rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Customers;
