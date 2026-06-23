import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { useRole } from '../lib/RoleContext';
import { 
  getProfile, 
  saveProfile, 
  backupBusinessData,
  restoreBusinessData
} from '../lib/db';
import { exportToCSV } from '../lib/utils';
import PaymentReminders from '../components/PaymentReminders';
import InventoryManagement from '../components/InventoryManagement';
import RecurringInvoices from '../components/RecurringInvoices';
import InvoiceTemplates from '../components/InvoiceTemplates';

function Settings() {
  const { userId, loading: userLoading } = useUser();
  const { tenantId } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    business_name: '', owner_name: '', phone: '', email: '', address: '',
    gstin: '', state: '', logo_url: '', bank_name: '', account_no: '',
    ifsc: '', upi_id: '', invoice_prefix: 'INV', default_due_days: 7, currency_symbol: '₹', terms: '',
  });

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    getProfile(tenantId).then((profile) => {
      if (profile) {
        setForm({
          business_name: profile.business_name || '',
          owner_name: profile.owner_name || '',
          phone: profile.phone || '',
          email: profile.email || '',
          address: profile.address || '',
          gstin: profile.gstin || '',
          state: profile.state || '',
          logo_url: profile.logo_url || '',
          bank_name: profile.bank_name || '',
          account_no: profile.account_no || '',
          ifsc: profile.ifsc || '',
          upi_id: profile.upi_id || '',
          invoice_prefix: profile.invoice_prefix || 'INV',
          default_due_days: profile.default_due_days ?? 7,
          currency_symbol: profile.currency_symbol || '₹',
          terms: profile.terms || '',
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tenantId]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setMessage('');
    try {
      await saveProfile(tenantId, { ...form, default_due_days: Number(form.default_due_days) });
      setMessage('Business settings saved successfully.');
    } catch {
      setMessage('Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };



  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupError('');
    setBackupSuccess('');
    try {
      const data = await backupBusinessData(tenantId);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `billbook_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setBackupSuccess('✓ Backup downloaded successfully');
      setTimeout(() => setBackupSuccess(''), 4000);
    } catch (err) {
      setBackupError(err.message || 'Failed to generate backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      "⚠️ WARNING: This will delete and overwrite all current business data (Products, Customers, Suppliers, Expenses, Invoices, Payments, Reminders, and Alerts). This cannot be undone. Are you sure you want to proceed?"
    );
    if (!confirmRestore) {
      e.target.value = ''; // Reset file input
      return;
    }

    setRestoreLoading(true);
    setBackupError('');
    setBackupSuccess('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);
          await restoreBusinessData(tenantId, parsedData);
          setBackupSuccess('✓ Data restored successfully. Reloading business profile...');
          e.target.value = ''; // Reset input
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } catch (err) {
          setBackupError('Invalid backup JSON format or corrupted file: ' + err.message);
          setRestoreLoading(false);
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setBackupError(err.message || 'Failed to read backup file');
      setRestoreLoading(false);
      e.target.value = '';
    }
  };

  if (loading || userLoading) {
    return <PageSection eyebrow="Setup" title="Business settings" description="Loading..." />;
  }

  return (
    <>
      <PageSection eyebrow="Setup" title="Business settings" description="Your billing details appear on every invoice and report.">
        <form className="settings-form" onSubmit={handleSubmit}>
          <label>Business name
            <input type="text" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} required />
          </label>
          <label>Owner name
            <input type="text" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} />
          </label>
          <label>Phone
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </label>
          <label className="form-span-2">Address
            <textarea rows="3" value={form.address} onChange={(e) => update('address', e.target.value)} />
          </label>
          <label>GSTIN
            <input type="text" value={form.gstin} onChange={(e) => update('gstin', e.target.value)} />
          </label>
          <label>State
            <input type="text" value={form.state} onChange={(e) => update('state', e.target.value)} />
          </label>
          <label>Bank name
            <input type="text" value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} />
          </label>
          <label>Account number
            <input type="text" value={form.account_no} onChange={(e) => update('account_no', e.target.value)} />
          </label>
          <label>IFSC code
            <input type="text" value={form.ifsc} onChange={(e) => update('ifsc', e.target.value)} />
          </label>
          <label>UPI ID
            <input type="text" value={form.upi_id} onChange={(e) => update('upi_id', e.target.value)} />
          </label>
          <label>Logo URL
            <input type="text" value={form.logo_url} onChange={(e) => update('logo_url', e.target.value)} placeholder="https://..." />
          </label>
          <label>Currency symbol
            <input type="text" value={form.currency_symbol} onChange={(e) => update('currency_symbol', e.target.value)} />
          </label>
          <label>Default due days
            <input type="number" min="0" value={form.default_due_days} onChange={(e) => update('default_due_days', e.target.value)} />
          </label>
          <label className="form-span-2">Terms & conditions (shown on invoices)
            <textarea rows="3" value={form.terms} onChange={(e) => update('terms', e.target.value)} />
          </label>
          <label>Invoice prefix
            <input type="text" value={form.invoice_prefix} onChange={(e) => update('invoice_prefix', e.target.value)} />
          </label>
          {message && <p className="form-message form-success form-span-2">{message}</p>}
          <div className="form-span-2">
            <button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save settings'}</button>
          </div>
        </form>
      </PageSection>

      <PageSection 
        eyebrow="Automation" 
        title="Payment Reminders" 
        description="Automate payment reminders for your invoices to improve cash flow."
      >
        <PaymentReminders tenantId={tenantId} />
      </PageSection>

      <PageSection 
        eyebrow="Inventory" 
        title="Stock Management" 
        description="Monitor inventory levels and set up automatic stock alerts."
      >
        <InventoryManagement tenantId={tenantId} />
      </PageSection>

      <PageSection 
        eyebrow="Automation" 
        title="Recurring Invoices" 
        description="Set up automatic recurring invoices for regular billing."
      >
        <RecurringInvoices tenantId={tenantId} />
      </PageSection>

      <PageSection 
        eyebrow="Customization" 
        title="Invoice Templates" 
        description="Create and manage custom invoice templates with your branding."
      >
        <InvoiceTemplates />
      </PageSection>

      <PageSection 
        eyebrow="Data Security" 
        title="Full Business Backup & Restore" 
        description="Download a full local copy of your database, or restore data from a previous backup file."
      >
        <div className="content-card" style={{ padding: 24 }}>
          {backupSuccess && <p className="form-message form-success">{backupSuccess}</p>}
          {backupError && <p className="form-message form-error">{backupError}</p>}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Backup Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>💾 Backup Business Data</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Download a complete secure JSON snapshot of your business settings, customer directories, product lists, invoices, payments, and expenses.
              </p>
              <button 
                type="button" 
                className="primary-button" 
                onClick={handleBackup} 
                disabled={backupLoading}
                style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
              >
                {backupLoading ? 'Generating Backup...' : 'Download JSON Backup'}
              </button>
            </div>

            {/* Restore Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>🔄 One-Click Restore</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Upload a previously saved JSON backup file to restore all directories and records. This will overwrite all active settings.
              </p>
              <div style={{ marginTop: 'auto' }}>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleRestore}
                  disabled={restoreLoading}
                  style={{ display: 'none' }}
                  id="restore-file-input"
                />
                <label 
                  htmlFor="restore-file-input"
                  className="secondary-button"
                  style={{ 
                    display: 'inline-block', 
                    cursor: restoreLoading ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600
                  }}
                >
                  {restoreLoading ? 'Restoring Data...' : 'Upload & Restore Backup'}
                </label>
              </div>
            </div>
          </div>
        </div>
      </PageSection>
    </>
  );
}

export default Settings;
