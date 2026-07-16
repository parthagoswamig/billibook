import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import SimpleTable from '../components/SimpleTable';
import Pagination from '../components/Pagination';
import { useUser } from '../lib/useUser';
import { getExpenses, addExpense, updateExpense, deleteExpense, bulkImportExpenses } from '../lib/db';
import { formatCurrency, formatDate, exportToCSV, EXPENSE_CATEGORIES, importFromCSV } from '../lib/utils';
import { useRole } from '../lib/RoleContext';
import { useBusiness } from '../lib/BusinessContext';
function Expenses() {
  const { userId, loading: userLoading } = useUser();
  const { currency } = useBusiness();
  const { canCreate, canDelete, tenantId } = useRole();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const limit = 50;
  const [form, setForm] = useState({
    category: 'Rent', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash',
  });

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getExpenses(tenantId, page, limit, searchTerm, selectedCategoryFilter);
      setExpenses(data);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, page, searchTerm, selectedCategoryFilter]);

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1); }, [selectedCategoryFilter, searchTerm]);

  const openAdd = () => {
    setEditId(null);
    setForm({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash' });
    setError('');
    setMessage('');
    setShowModal(true);
  };

  const openEdit = (exp) => {
    setEditId(exp.id);
    setForm({ category: exp.category, description: exp.description || '', amount: exp.amount, date: exp.date, payment_mode: exp.payment_mode || 'Cash' });
    setError('');
    setMessage('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !form.category || !form.amount) return;
    if (editId) {
      if (!canCreate('expenses')) return;
      try {
        await updateExpense(editId, {
          category: form.category,
          description: form.description,
          amount: parseFloat(form.amount),
          date: form.date,
          payment_mode: form.payment_mode,
        });
        setShowModal(false);
        setEditId(null);
        setForm({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash' });
        setMessage('✓ Expense updated');
        setTimeout(() => setMessage(''), 3000);
        load();
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    if (!canCreate('expenses')) return;
    try {
      await addExpense(tenantId, {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        date: form.date,
        payment_mode: form.payment_mode,
      });
      setShowModal(false);
      setForm({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash' });
      setMessage('✓ Expense recorded');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete('expenses')) return;
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = () => {
    exportToCSV(
      'expenses.csv',
      ['Category', 'Description', 'Amount', 'Date', 'Payment Mode'],
      expenses.map((e) => [e.category, e.description || '', e.amount, e.date, e.payment_mode]),
    );
  };

  const handleImport = async () => {
    if (!canCreate() || !tenantId) return;
    try {
      const data = await importFromCSV();
      if (!data || data.length === 0) {
        setError('No data found in CSV file');
        return;
      }
      await bulkImportExpenses(tenantId, data);
      setMessage(`✓ Imported ${data.length} expenses`);
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message || 'Failed to import expenses');
    }
  };

  const rows = expenses.map((e) => [
    e.category,
    formatCurrency(e.amount, currency),
    formatDate(e.date),
    e.payment_mode || 'Cash',
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <>
      <PageSection
        eyebrow="Costs"
        title="Expenses"
        description="Track all business spending — rent, utilities, salaries, and more."
        actions={
          <>
            <input className="form-input search-input" placeholder="Search description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {canCreate() && <button className="secondary-button" type="button" onClick={handleImport}>📤 Import CSV</button>}
            <button className="secondary-button" type="button" onClick={handleExport}>📥 Export CSV</button>
            {canCreate() && <button className="primary-button" type="button" onClick={openAdd}>+ Add expense</button>}
          </>
        }
      >
        {message && <p className="form-message form-success">{message}</p>}
        {error && <p className="form-message form-error">{error}</p>}

        {/* Horizontal Category Chips Row */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '20px', whiteSpace: 'nowrap' }}>
          {['All', ...EXPENSE_CATEGORIES].map((cat) => {
            const isActive = selectedCategoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { setSelectedCategoryFilter(cat); setPage(1); }}
                style={{
                  background: isActive ? 'var(--accent)' : 'white',
                  color: isActive ? 'white' : '#334155',
                  border: isActive ? '1.5px solid var(--accent)' : '1.5px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : 'normal',
                  transition: 'all 0.12s ease',
                  flexShrink: 0,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {loading || userLoading ? (
          <div className="empty-state">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">No expenses recorded yet.</div>
        ) : (
          <>
            <SimpleTable columns={['Category', 'Amount', 'Date', 'Payment']} rows={rows} rowIds={expenses.map((e) => e.id)} />
            <div className="table-actions-list">
              {expenses.map((e) => (
                <div key={e.id} className="table-action-row">
                  <span>{e.category} — {e.description || 'No description'}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {canCreate() && <button className="action-button" type="button" onClick={() => openEdit(e)}>Edit</button>}
                    {canDelete() && <button className="action-button danger-btn" type="button" onClick={() => handleDelete(e.id)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </>
        )}
      </PageSection>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit Expense' : 'Add Expense'}</h3>
              <button className="modal-close" type="button" onClick={() => { setShowModal(false); setEditId(null); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {error && <p className="form-message form-error" style={{ marginBottom: '16px', gridColumn: '1 / -1' }}>{error}</p>}
              <label className="form-label"><span>Category *</span>
                <select className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="form-label"><span>Description</span>
                <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="form-label"><span>Amount *</span>
                <input type="number" className="form-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} step="0.01" required />
              </label>
              <div className="form-row">
                <label className="form-label"><span>Date</span>
                  <input type="date" className="form-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </label>
                <label className="form-label"><span>Payment Mode</span>
                  <select className="form-input" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                    {['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Credit Card'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>
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

export default Expenses;
