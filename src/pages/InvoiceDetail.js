import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import {
  getInvoiceById, getInvoicePayments, updateInvoiceNotes,
  deleteInvoice, recordPayment, convertToInvoice, DOCUMENT_KINDS,
} from '../lib/db';
import {
  formatCurrency, formatDate, PAYMENT_MODES, splitGst,
  buildWhatsAppUrl, getDocumentDetailRoute,
} from '../lib/utils';
import './InvoiceDetail.css';
function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, currency } = useBusiness();
  const { canEdit, canDelete, canCreate, tenantId } = useRole();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editNotes, setEditNotes] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'Cash', note: '' });

  const load = async () => {
    try {
      const [inv, pays] = await Promise.all([getInvoiceById(id), getInvoicePayments(id)]);
      setInvoice(inv);
      setPayments(pays);
      setNotes(inv.notes || '');
    } catch {
      setError('Document not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (invoice && location.state?.autoPrint) {
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [invoice, location.state]);

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!invoice) return <div className="loading-screen">Not found</div>;

  const cfg = DOCUMENT_KINDS[invoice.document_kind] || DOCUMENT_KINDS.sale_invoice;
  const backRoute = getDocumentDetailRoute(invoice.document_kind);
  const items = invoice.invoice_items || [];
  const fmt = (n) => formatCurrency(n, currency);
  const supplyState = invoice.state_of_supply || invoice.customers?.state || '';
  const isInterState = profile?.state && supplyState && profile.state !== supplyState;
  const gstSplit = splitGst(invoice.gst_amount, isInterState);
  const canPay = cfg.payment && invoice.status !== 'paid';
  const canConvert = ['quotation', 'estimate', 'proforma_invoice'].includes(invoice.document_kind);

  const handleSaveNotes = async () => {
    if (!canEdit()) return;
    await updateInvoiceNotes(invoice.id, notes);
    setEditNotes(false);
    setMessage('✓ Updated');
    load();
  };

  const handleDelete = async () => {
    if (!canDelete()) return;
    if (!window.confirm('Delete permanently?')) return;
    await deleteInvoice(invoice.id, tenantId, invoice.type, items, invoice.document_kind);
    navigate(backRoute);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!canCreate()) return;
    await recordPayment(invoice.id, parseFloat(payForm.amount), payForm.payment_mode, payForm.note);
    setShowPayModal(false);
    load();
  };

  const handleConvert = async () => {
    if (!canCreate()) return;
    const newInv = await convertToInvoice(tenantId, invoice.id);
    navigate(`/invoices/${newInv.id}`);
  };
  const shareText = `${cfg.label} ${invoice.invoice_no}\nTotal: ${fmt(invoice.total)}\nBalance: ${fmt(invoice.balance)}\nDue: ${formatDate(invoice.due_date)}`;
  const whatsappUrl = buildWhatsAppUrl(invoice.customers?.phone, shareText);

  return (
    <>
      <PageSection
        eyebrow={cfg.label}
        title={`${invoice.invoice_no}`}
        description={formatDate(invoice.date)}
        actions={
          <div className="action-buttons no-print">
            <button className="secondary-button" type="button" onClick={() => navigate(backRoute)}>← Back</button>
            <button className="secondary-button" type="button" onClick={() => window.print()}>🖨️ Print</button>
            <button className="secondary-button" type="button" onClick={() => window.open(`mailto:${invoice.customers?.email || ''}?subject=${invoice.invoice_no}&body=${encodeURIComponent(shareText)}`)}>📧 Email</button>
            {invoice.customers?.phone && (
              <a className="secondary-button wa-btn" href={whatsappUrl} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            )}
            {canConvert && canCreate() && <button className="primary-button" type="button" onClick={handleConvert}>→ Convert to Invoice</button>}
            {canPay && canCreate() && <button className="primary-button" type="button" onClick={() => setShowPayModal(true)}>💳 Payment</button>}
            {canEdit() && <button className="secondary-button" type="button" onClick={() => setEditNotes(!editNotes)}>✏️ Notes</button>}
          </div>
        }
      >
        <div className="invoice-detail-container" id="invoice-print-area">
          {message && <p className="form-message form-success no-print">{message}</p>}
          {error && <p className="form-message form-error no-print">{error}</p>}

          <div className="invoice-print-header">
            {profile?.logo_url && <img src={profile.logo_url} alt="" className="invoice-logo" />}
            <div>
              <h2 className="business-name">{profile?.business_name || 'Business'}</h2>
              {profile?.address && <p className="business-detail">{profile.address}</p>}
              {profile?.gstin && <p className="business-detail">GSTIN: {profile.gstin}</p>}
            </div>
          </div>

          <div className="invoice-header">
            <div><h2>{cfg.label}</h2><span className={`status-badge status-${invoice.status}`}>{invoice.status}</span></div>
            <div><p>Date: {formatDate(invoice.date)}</p>{invoice.due_date && <p>Due: {formatDate(invoice.due_date)}</p>}</div>
          </div>

          <div className="section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <h3>{invoice.type === 'purchase' ? 'Supplier' : 'Bill To'}</h3>
              <p className="customer-name">{invoice.customers?.name || 'Walk-in Customer'}</p>
              {invoice.customers?.gstin && <p style={{ fontSize: '13px', marginTop: '4px' }}><strong>GSTIN:</strong> {invoice.customers.gstin}</p>}
              {invoice.customers?.address && <p style={{ fontSize: '13px', marginTop: '2px' }}><strong>Address:</strong> {invoice.customers.address}</p>}
              {invoice.customers?.phone && <p style={{ fontSize: '13px', marginTop: '2px' }}><strong>Phone:</strong> {invoice.customers.phone}</p>}
            </div>
            <div>
              <h3>Supply & Dispatch Details</h3>
              <p style={{ fontSize: '13px' }}><strong>Place of Supply (State):</strong> {supplyState || 'Not Specified'}</p>
              {invoice.due_date && <p style={{ fontSize: '13px', marginTop: '4px' }}><strong>Due Date:</strong> {formatDate(invoice.due_date)}</p>}
              <p style={{ fontSize: '13px', marginTop: '4px' }}><strong>Status:</strong> <span className={`status-badge status-${invoice.status}`} style={{ marginLeft: '6px' }}>{invoice.status}</span></p>
            </div>
          </div>

          <div className="section">
            <div className="items-table">
              <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.8fr 0.8fr 1.2fr', gap: '12px' }}>
                <div className="col-description" style={{ textAlign: 'left' }}>Item</div>
                <div>HSN</div>
                <div className="col-qty">Qty</div>
                <div className="col-rate">Rate</div>
                <div style={{ textAlign: 'right' }}>Disc%</div>
                <div className="col-tax">GST%</div>
                <div className="col-amount">Total</div>
              </div>
              {items.map((item) => {
                const qty = parseFloat(item.qty) || 0;
                const price = parseFloat(item.price) || 0;
                const itemDisc = parseFloat(item.discount) || 0;
                const gstRate = parseFloat(item.gst) || 0;
                const base = qty * price;
                const discAmt = base * (itemDisc / 100);
                const taxable = base - discAmt;
                const rowGst = taxable * (gstRate / 100);
                const netRowAmount = taxable + rowGst;

                return (
                  <div key={item.id} className="table-row" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.8fr 0.8fr 1.2fr', gap: '12px' }}>
                    <div className="col-description" style={{ textAlign: 'left' }}>
                      {item.name}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{item.hsn || '—'}</div>
                    <div className="col-qty">{item.qty} {item.unit || 'Pcs'}</div>
                    <div className="col-rate">{fmt(item.price)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.discount > 0 ? `${item.discount}%` : '—'}</div>
                    <div className="col-tax">{item.gst}%</div>
                    <div className="col-amount">{fmt(netRowAmount)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="totals-section">
            <div className="total-row"><span>Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
            {parseFloat(invoice.shipping_charges) > 0 && <div className="total-row"><span>Shipping Charges</span><span>{fmt(invoice.shipping_charges)}</span></div>}
            {parseFloat(invoice.discount) > 0 && <div className="total-row"><span>Discount</span><span>-{fmt(invoice.discount)}</span></div>}
            {gstSplit.cgst > 0 && <><div className="total-row"><span>CGST</span><span>{fmt(gstSplit.cgst)}</span></div><div className="total-row"><span>SGST</span><span>{fmt(gstSplit.sgst)}</span></div></>}
            {gstSplit.igst > 0 && <div className="total-row"><span>IGST</span><span>{fmt(gstSplit.igst)}</span></div>}
            {parseFloat(invoice.round_off) !== 0 && <div className="total-row"><span>Round off</span><span>{fmt(invoice.round_off)}</span></div>}
            <div className="total-row grand-total"><span>Total</span><span>{fmt(invoice.total)}</span></div>
            {cfg.payment && <><div className="total-row"><span>Paid</span><span>{fmt(invoice.paid)}</span></div><div className="total-row"><span>Balance</span><span>{fmt(invoice.balance)}</span></div></>}
          </div>

          {(profile?.bank_name || profile?.upi_id) && (
            <div className="section bank-section">
              <h3>Pay via</h3>
              {profile.bank_name && <p>{profile.bank_name} | {profile.account_no} | {profile.ifsc}</p>}
              {profile.upi_id && <p>UPI: {profile.upi_id}</p>}
            </div>
          )}

          {profile?.terms && <div className="section"><h3>Terms</h3><p>{profile.terms}</p></div>}

          {editNotes ? (
            <div className="section no-print">
              <textarea className="form-input" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="primary-button" type="button" onClick={handleSaveNotes}>Save</button>
                {canDelete() && <button className="delete-btn" type="button" onClick={handleDelete}>Delete</button>}
              </div>
            </div>
          ) : invoice.notes && <div className="section"><h3>Notes</h3><p>{invoice.notes}</p></div>}

          {payments.length > 0 && (
            <div className="section no-print"><h3>Payments</h3>
              {payments.map((p) => <p key={p.id}>{formatDate(p.created_at)} — {fmt(p.amount)} ({p.payment_mode})</p>)}
            </div>
          )}
        </div>
      </PageSection>

      {showPayModal && (
        <div className="modal-overlay no-print" onClick={() => setShowPayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handlePayment} className="modal-form">
              <h3>Record Payment — Balance {fmt(invoice.balance)}</h3>
              <input type="number" className="form-input" placeholder="Amount" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required max={invoice.balance} step="0.01" />
              <select className="form-input" value={payForm.payment_mode} onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@media print { .no-print, .sidebar, .page-header { display: none !important; } body { background: white; color: black; } }`}</style>
    </>
  );
}

export default InvoiceDetail;
