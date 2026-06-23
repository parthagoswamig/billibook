import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import SimpleTable from '../components/SimpleTable';
import { useUser } from '../lib/useUser';
import { getExpenses, addExpense, deleteExpense, bulkImportExpenses } from '../lib/db';
import { formatCurrency, formatDate, exportToCSV, EXPENSE_CATEGORIES, importFromCSV } from '../lib/utils';
import { useRole } from '../lib/RoleContext';
function Expenses() {
  const { userId, loading: userLoading } = useUser();
  const { canCreate, canDelete, tenantId } = useRole();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [form, setForm] = useState({
    category: 'Rent', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash',
  });

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setExpenses(await getExpenses(tenantId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !form.category || !form.amount) return;
    if (!canCreate()) return;
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
    if (!canDelete()) return;
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

  // Calculate sum per category for chips
  const getCategoryTotal = (cat) => {
    return expenses
      .filter((e) => cat === 'All' || e.category === cat)
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  };

  const filteredExpenses = selectedCategoryFilter === 'All' 
    ? expenses 
    : expenses.filter(e => e.category === selectedCategoryFilter);

  const rows = filteredExpenses.map((e) => [
    e.category,
    formatCurrency(e.amount),
    formatDate(e.date),
    e.payment_mode || 'Cash',
  ]);

  return (
    <>
      <PageSection
        eyebrow="Costs"
        title="Expenses"
        description="Track all business spending — rent, utilities, salaries, and more."
        actions={
          <>
            {canCreate() && <button className="secondary-button" type="button" onClick={handleImport}>📤 Import CSV</button>}
            <button className="secondary-button" type="button" onClick={handleExport}>📥 Export CSV</button>
            {canCreate() && <button className="primary-button" type="button" onClick={() => { setShowModal(true); setError(''); }}>+ Add expense</button>}
          </>
        }
      >
        {message && <p className="form-message form-success">{message}</p>}
        {error && <p className="form-message form-error">{error}</p>}

        {/* Horizontal Category Chips Row */}
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '16px',
          marginBottom: '20px',
          whiteSpace: 'nowrap'
        }}>
          {['All', ...EXPENSE_CATEGORIES].map((cat) => {
            const isActive = selectedCategoryFilter === cat;
            const total = getCategoryTotal(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                style={{
                  background: isActive ? 'var(--accent)' : 'white',
                  color: isActive ? 'white' : '#334155',
                  border: isActive ? '1.5px solid var(--accent)' : '1.5px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : 'normal',
                  transition: 'all 0.12s ease'
                }}
              >
                <span>{cat}</span>
                <span style={{
                  fontWeight: '700',
                  color: isActive ? 'white' : 'var(--danger)',
                  fontSize: '12px'
                }}>
                  {formatCurrency(total)}
                </span>
              </button>
            );
          })}
        </div>

        {loading || userLoading ? (
          <div className="empty-state">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state">No expenses recorded yet.</div>
        ) : (
          <>
            <SimpleTable columns={['Category', 'Amount', 'Date', 'Payment']} rows={rows} rowIds={filteredExpenses.map((e) => e.id)} />
            <div className="table-actions-list">
              {filteredExpenses.map((e) => (
                <div key={e.id} className="table-action-row">
                  <span>{e.category} — {e.description || 'No description'}</span>
                  {canDelete() && <button className="action-button danger-btn" type="button" onClick={() => handleDelete(e.id)}>Delete</button>}
                </div>
              ))}
            </div>
          </>
        )}
      </PageSection>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Expense</h3>
              <button className="modal-close" type="button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
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
