import React, { useEffect, useState } from 'react';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { 
  getRecurringInvoices, 
  createRecurringInvoice, 
  pauseRecurringInvoice, 
  resumeRecurringInvoice, 
  deleteRecurringInvoice,
  generateInvoiceFromRecurring,
  getInvoices 
} from '../lib/db';
import { formatCurrency, formatDate } from '../lib/utils';

function RecurringInvoices({ tenantId }) {
  const { userId } = useUser();
  const activeTenantId = tenantId || userId;
  const { currency } = useBusiness();
  const { canCreate, canEdit, canDelete } = useRole();
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    base_invoice_id: '',
    customer_id: '',
    frequency: 'monthly',
    interval: 1,
    next_invoice_date: '',
    end_date: '',
    max_invoices: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTenantId]);

  const loadData = async () => {
    if (!activeTenantId) return;
    try {
      const [recurring, allInvoices] = await Promise.all([
        getRecurringInvoices(activeTenantId),
        getInvoices(activeTenantId)
      ]);
      setRecurringInvoices(recurring);
      setInvoices(allInvoices);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecurring = async (e) => {
    e.preventDefault();
    if (!activeTenantId) return;
    if (!canCreate()) return;
    
    try {
      const baseInvoice = invoices.find(inv => inv.id === form.base_invoice_id);
      await createRecurringInvoice(activeTenantId, {
        base_invoice_id: form.base_invoice_id,
        customer_id: baseInvoice?.customer_id,
        frequency: form.frequency,
        interval: form.interval,
        next_invoice_date: form.next_invoice_date,
        end_date: form.end_date || null,
        max_invoices: form.max_invoices ? parseInt(form.max_invoices) : null
      });

      setMessage('✓ Recurring invoice created successfully');
      setShowModal(false);
      setForm({ base_invoice_id: '', customer_id: '', frequency: 'monthly', interval: 1, next_invoice_date: '', end_date: '', max_invoices: '' });
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create recurring invoice');
    }
  };

  const handleGenerateNow = async (recurringId) => {
    if (!canCreate()) return;
    if (!confirm('Generate invoice from this recurring template now?')) return;
    
    try {
      await generateInvoiceFromRecurring(recurringId);
      setMessage('✓ Invoice generated successfully');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to generate invoice');
    }
  };

  const handlePause = async (recurringId) => {
    if (!canEdit()) return;
    try {
      await pauseRecurringInvoice(recurringId);
      setMessage('✓ Recurring invoice paused');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to pause recurring invoice');
    }
  };

  const handleResume = async (recurringId) => {
    if (!canEdit()) return;
    try {
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 1);
      await resumeRecurringInvoice(recurringId, nextDate.toISOString().split('T')[0]);
      setMessage('✓ Recurring invoice resumed');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to resume recurring invoice');
    }
  };

  const handleDelete = async (recurringId) => {
    if (!canDelete()) return;
    if (!confirm('Are you sure you want to delete this recurring invoice?')) return;
    
    try {
      await deleteRecurringInvoice(recurringId);
      setMessage('✓ Recurring invoice deleted');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete recurring invoice');
    }
  };

  const getFrequencyLabel = (frequency, interval) => {
    const labels = {
      'daily': interval === 1 ? 'Daily' : `Every ${interval} Days`,
      'weekly': interval === 1 ? 'Weekly' : `Every ${interval} Weeks`,
      'monthly': interval === 1 ? 'Monthly' : `Every ${interval} Months`,
      'quarterly': interval === 1 ? 'Quarterly' : `Every ${interval} Quarters`,
      'yearly': interval === 1 ? 'Yearly' : `Every ${interval} Years`
    };
    return labels[frequency] || frequency;
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    const target = new Date(dateStr);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) return <div className="loading-screen">Loading recurring invoices...</div>;

  return (
    <div className="recurring-invoices">
      <div className="recurring-header">
        <h2>🔄 Recurring Invoices</h2>
        {canCreate() && (
          <button 
            className="primary-button" 
            onClick={() => setShowModal(true)}
            type="button"
          >
            + Create Recurring
          </button>
        )}
      </div>

      {message && <p className="form-message form-success">{message}</p>}
      {error && <p className="form-message form-error">{error}</p>}

      {recurringInvoices.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔄</span>
          <p className="muted-text">No recurring invoices set up</p>
          <p className="muted-text">Create recurring invoices to automate billing for regular customers</p>
        </div>
      ) : (
        <div className="recurring-list">
          {recurringInvoices.map((recurring) => {
            const daysUntil = getDaysUntil(recurring.next_invoice_date);
            const isOverdue = daysUntil !== null && daysUntil < 0;
            
            return (
              <div key={recurring.id} className="recurring-card">
                <div className="recurring-info">
                  <div className="recurring-main">
                    <span className="recurring-customer">{recurring.customers?.name}</span>
                    <span className="recurring-frequency">{getFrequencyLabel(recurring.frequency, recurring.interval)}</span>
                  </div>
                  <div className="recurring-details">
                    <span className="recurring-base">Base: {recurring.base_invoice?.invoice_no}</span>
                    <span className="recurring-amount">{formatCurrency(recurring.base_invoice?.total, currency)}</span>
                  </div>
                  <div className="recurring-meta">
                    <span className={`next-date ${isOverdue ? 'overdue' : ''}`}>
                      Next: {formatDate(recurring.next_invoice_date)}
                      {daysUntil !== null && (
                        <span className="days-badge">
                          {isOverdue ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`}
                        </span>
                      )}
                    </span>
                    <span className="invoice-count">Generated: {recurring.invoice_count}</span>
                    {recurring.end_date && (
                      <span className="end-date">Ends: {formatDate(recurring.end_date)}</span>
                    )}
                  </div>
                </div>
                <div className="recurring-actions">
                  {canCreate() && (
                    <button 
                      className="action-button generate-btn"
                      onClick={() => handleGenerateNow(recurring.id)}
                      type="button"
                    >
                      Generate Now
                    </button>
                  )}
                  {recurring.status === 'active' ? (
                    canEdit() && (
                      <button 
                        className="action-button pause-btn"
                        onClick={() => handlePause(recurring.id)}
                        type="button"
                      >
                        Pause
                      </button>
                    )
                  ) : (
                    canEdit() && (
                      <button 
                        className="action-button resume-btn"
                        onClick={() => handleResume(recurring.id)}
                        type="button"
                      >
                        Resume
                      </button>
                    )
                  )}
                  {canDelete() && (
                    <button 
                      className="action-button delete-btn"
                      onClick={() => handleDelete(recurring.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Recurring Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Recurring Invoice</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRecurring} className="modal-form">
              <div className="form-label">
                <span>Base Invoice</span>
                <select 
                  className="form-input"
                  value={form.base_invoice_id}
                  onChange={(e) => setForm({ ...form, base_invoice_id: e.target.value })}
                  required
                >
                  <option value="">Select an invoice to use as template...</option>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_no} - {formatCurrency(invoice.total, currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-label">
                <span>Frequency</span>
                <select 
                  className="form-input"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="form-label">
                <span>Interval</span>
                <input 
                  type="number" 
                  className="form-input"
                  value={form.interval}
                  onChange={(e) => setForm({ ...form, interval: parseInt(e.target.value) })}
                  min="1"
                  required
                />
                <span className="form-hint">How often to repeat (e.g., 1 = every month, 2 = every 2 months)</span>
              </div>

              <div className="form-label">
                <span>Next Invoice Date</span>
                <input 
                  type="date" 
                  className="form-input"
                  value={form.next_invoice_date}
                  onChange={(e) => setForm({ ...form, next_invoice_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-label">
                <span>End Date (Optional)</span>
                <input 
                  type="date" 
                  className="form-input"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
                <span className="form-hint">Leave blank for no end date</span>
              </div>

              <div className="form-label">
                <span>Maximum Invoices (Optional)</span>
                <input 
                  type="number" 
                  className="form-input"
                  value={form.max_invoices}
                  onChange={(e) => setForm({ ...form, max_invoices: e.target.value })}
                  min="1"
                />
                <span className="form-hint">Stop after generating this many invoices</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create Recurring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecurringInvoices;
