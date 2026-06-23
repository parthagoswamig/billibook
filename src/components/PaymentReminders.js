import React, { useEffect, useState } from 'react';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { 
  getPaymentReminders, 
  createPaymentReminder, 
  updateReminderStatus, 
  deleteReminder,
  getDueInvoicesForReminders 
} from '../lib/db';
import { formatCurrency, formatDate, buildPaymentReminderMessage, buildWhatsAppUrl } from '../lib/utils';

function PaymentReminders({ tenantId }) {
  const { userId } = useUser();
  const activeTenantId = tenantId || userId;
  const { business_name, currency } = useBusiness();
  const { canCreate, canDelete } = useRole();
  const [reminders, setReminders] = useState([]);
  const [dueInvoices, setDueInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    invoice_id: '',
    reminder_type: 'due_date',
    days_before: 3,
    custom_date: '',
    sent_via: ['whatsapp']
  });

  useEffect(() => {
    loadReminders();
    loadDueInvoices();
  }, [activeTenantId]);

  const loadReminders = async () => {
    if (!activeTenantId) return;
    try {
      const data = await getPaymentReminders(activeTenantId);
      setReminders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDueInvoices = async () => {
    if (!activeTenantId) return;
    try {
      const data = await getDueInvoicesForReminders(activeTenantId);
      setDueInvoices(data);
    } catch (err) {
      console.error('Error loading due invoices:', err);
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!activeTenantId) return;
    if (!canCreate()) return;
    
    try {
      let reminderDate;
      
      if (form.reminder_type === 'custom') {
        reminderDate = form.custom_date;
      } else if (form.invoice_id) {
        const invoice = dueInvoices.find(inv => inv.id === form.invoice_id);
        if (invoice) {
          const dueDate = new Date(invoice.due_date);
          if (form.reminder_type === 'before_due') {
            dueDate.setDate(dueDate.getDate() - form.days_before);
          }
          reminderDate = dueDate.toISOString().split('T')[0];
        }
      } else {
        setError('Please select an invoice');
        return;
      }

      const invoice = dueInvoices.find(inv => inv.id === form.invoice_id);
      await createPaymentReminder(activeTenantId, {
        invoice_id: form.invoice_id,
        customer_id: invoice?.customers?.id,
        reminder_date: reminderDate,
        reminder_type: form.reminder_type,
        days_before: form.reminder_type === 'before_due' ? form.days_before : null,
        sent_via: form.sent_via
      });

      setMessage('✓ Reminder created successfully');
      setShowModal(false);
      setForm({ invoice_id: '', reminder_type: 'due_date', days_before: 3, custom_date: '', sent_via: ['whatsapp'] });
      loadReminders();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create reminder');
    }
  };

  const handleSendReminder = async (reminder) => {
    if (!canCreate()) return;
    try {
      const invoice = dueInvoices.find(inv => inv.id === reminder.invoice_id);
      if (!invoice || !invoice.customers?.phone) {
        setError('Customer phone number not found');
        return;
      }

      const message = buildPaymentReminderMessage(invoice, invoice.customers, business_name, currency);
      const url = buildWhatsAppUrl(invoice.customers.phone, message);
      window.open(url, '_blank');

      await updateReminderStatus(reminder.id, 'sent');
      setMessage('✓ Reminder sent successfully');
      loadReminders();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to send reminder');
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    if (!canDelete()) return;
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    
    try {
      await deleteReminder(reminderId);
      setMessage('✓ Reminder deleted successfully');
      loadReminders();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete reminder');
    }
  };

  const getReminderTypeLabel = (type) => {
    const labels = {
      'due_date': 'On Due Date',
      'before_due': 'Before Due Date',
      'after_due': 'After Due Date',
      'custom': 'Custom Date'
    };
    return labels[type] || type;
  };

  if (loading) return <div className="loading-screen">Loading reminders...</div>;

  return (
    <div className="payment-reminders">
      <div className="reminders-header">
        <h2>🔔 Payment Reminders</h2>
        {canCreate() && (
          <button 
            className="primary-button" 
            onClick={() => setShowModal(true)}
            type="button"
          >
            + New Reminder
          </button>
        )}
      </div>

      {message && <p className="form-message form-success">{message}</p>}
      {error && <p className="form-message form-error">{error}</p>}

      {/* Due Invoices Section */}
      {dueInvoices.length > 0 && (
        <div className="due-invoices-section">
          <h3>📋 Invoices Due for Reminders</h3>
          <div className="due-invoices-list">
            {dueInvoices.map((invoice) => (
              <div key={invoice.id} className="due-invoice-card">
                <div className="invoice-info">
                  <span className="invoice-no">{invoice.invoice_no}</span>
                  <span className="customer-name">{invoice.customers?.name}</span>
                  <span className="due-date">Due: {formatDate(invoice.due_date)}</span>
                  <span className="balance">{formatCurrency(invoice.balance, currency)}</span>
                </div>
                {canCreate() && (
                  <button 
                    className="quick-reminder-btn"
                    onClick={() => {
                      setForm({ ...form, invoice_id: invoice.id });
                      setShowModal(true);
                    }}
                    type="button"
                  >
                    Set Reminder
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Reminders */}
      <div className="scheduled-reminders">
        <h3>📅 Scheduled Reminders</h3>
        {reminders.length === 0 ? (
          <p className="muted-text">No scheduled reminders</p>
        ) : (
          <div className="reminders-list">
            {reminders.map((reminder) => {
              const invoice = dueInvoices.find(inv => inv.id === reminder.invoice_id);
              return (
                <div key={reminder.id} className="reminder-card">
                  <div className="reminder-info">
                    <div className="reminder-main">
                      <span className="reminder-type">{getReminderTypeLabel(reminder.reminder_type)}</span>
                      <span className="reminder-date">{formatDate(reminder.reminder_date)}</span>
                    </div>
                    <div className="reminder-details">
                      <span className="invoice-ref">{invoice?.invoice_no || 'N/A'}</span>
                      <span className="customer-ref">{invoice?.customers?.name || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="reminder-status">
                    <span className={`status-badge status-${reminder.status}`}>
                      {reminder.status}
                    </span>
                    <div className="reminder-actions">
                      {reminder.status === 'pending' && canCreate() && (
                        <button 
                          className="action-button send-btn"
                          onClick={() => handleSendReminder(reminder)}
                          type="button"
                        >
                          Send Now
                        </button>
                      )}
                      {canDelete() && (
                        <button 
                          className="action-button delete-btn"
                          onClick={() => handleDeleteReminder(reminder.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Reminder Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Payment Reminder</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReminder} className="modal-form">
              <div className="form-label">
                <span>Select Invoice</span>
                <select 
                  className="form-input"
                  value={form.invoice_id}
                  onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}
                  required
                >
                  <option value="">Choose an invoice...</option>
                  {dueInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_no} - {invoice.customers?.name} - {formatCurrency(invoice.balance, currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-label">
                <span>Reminder Type</span>
                <select 
                  className="form-input"
                  value={form.reminder_type}
                  onChange={(e) => setForm({ ...form, reminder_type: e.target.value })}
                >
                  <option value="due_date">On Due Date</option>
                  <option value="before_due">Before Due Date</option>
                  <option value="after_due">After Due Date</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>

              {form.reminder_type === 'before_due' && (
                <div className="form-label">
                  <span>Days Before Due Date</span>
                  <input 
                    type="number" 
                    className="form-input"
                    value={form.days_before}
                    onChange={(e) => setForm({ ...form, days_before: parseInt(e.target.value) })}
                    min="1"
                    max="30"
                  />
                </div>
              )}

              {form.reminder_type === 'custom' && (
                <div className="form-label">
                  <span>Custom Date</span>
                  <input 
                    type="date" 
                    className="form-input"
                    value={form.custom_date}
                    onChange={(e) => setForm({ ...form, custom_date: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-label">
                <span>Send Via</span>
                <div className="checkbox-group">
                  <label>
                    <input 
                      type="checkbox"
                      checked={form.sent_via.includes('whatsapp')}
                      onChange={(e) => {
                        const newSentVia = e.target.checked 
                          ? [...form.sent_via, 'whatsapp']
                          : form.sent_via.filter(v => v !== 'whatsapp');
                        setForm({ ...form, sent_via: newSentVia });
                      }}
                    />
                    WhatsApp
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentReminders;
