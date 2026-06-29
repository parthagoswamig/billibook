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

function numberToWords(amount) {
  const num = Math.floor(amount);
  const paise = Math.round((amount - num) * 100);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function g(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  }

  function h(n) {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      str += g(n);
    }
    return str.trim();
  }

  function convert(n) {
    if (n === 0) return 'Zero';
    let word = '';
    if (n >= 10000000) {
      word += h(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      word += h(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      word += h(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      word += h(n);
    }
    return word.trim();
  }

  let finalStr = convert(num) + ' Rupees';
  if (paise > 0) {
    finalStr += ' and ' + convert(paise) + ' Paise';
  }
  return finalStr + ' Only';
}

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
      }, 1000);
    }
  }, [invoice, location]);

  if (loading) return <PageSection><div className="empty-state">Loading...</div></PageSection>;
  if (error || !invoice) return <PageSection><p className="form-message form-error">{error || 'Document not found'}</p></PageSection>;

  const items = invoice.invoice_items || [];
  const cfg = DOCUMENT_KINDS[invoice.document_kind] || { label: 'Invoice', route: '/invoices' };
  const backRoute = getDocumentDetailRoute(invoice.type, invoice.document_kind);
  const shareText = `Dear ${invoice.customers?.name || 'Customer'},\n\nPlease find attached ${cfg.label} ${invoice.invoice_no} for ${formatCurrency(invoice.total, currency)}.\n\nThank you,\n${profile?.business_name || 'us'}`;
  const whatsappUrl = buildWhatsAppUrl(invoice.customers?.phone, shareText);

  const canConvert = invoice.document_kind === 'quotation' || invoice.document_kind === 'proforma' || invoice.document_kind === 'delivery_challan';
  const canPay = (invoice.document_kind === 'sale_invoice' || invoice.document_kind === 'purchase_bill') && invoice.balance > 0;

  const handleSaveNotes = async () => {
    try {
      await updateInvoiceNotes(invoice.id, notes);
      setInvoice({ ...invoice, notes });
      setEditNotes(false);
      setMessage('Notes updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update notes');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleConvert = async () => {
    if (!window.confirm(`Are you sure you want to convert this ${cfg.label.toLowerCase()} to a Tax Invoice?`)) return;
    try {
      const newInv = await convertToInvoice(tenantId, invoice);
      setMessage('Converted successfully');
      setTimeout(() => setMessage(''), 3000);
      navigate(`/invoices/sale_invoice/${newInv.id}`);
    } catch (err) {
      setError(err.message || 'Conversion failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      const amt = parseFloat(payForm.amount);
      if (isNaN(amt) || amt <= 0 || amt > invoice.balance) {
        setError('Invalid payment amount');
        return;
      }
      await recordPayment(tenantId, invoice.id, {
        amount: amt,
        payment_mode: payForm.payment_mode,
        note: payForm.note,
      });
      setShowPayModal(false);
      setPayForm({ amount: '', payment_mode: 'Cash', note: '' });
      setMessage('Payment recorded successfully');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message || 'Failed to record payment');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document permanently?')) return;
    try {
      await deleteInvoice(invoice.id);
      navigate(backRoute);
    } catch (err) {
      setError(err.message || 'Failed to delete');
      setTimeout(() => setError(''), 3000);
    }
  };

  const fmt = (n) => formatCurrency(n, currency);
  const gstSplit = splitGst(invoice.gst_amount, invoice.state_of_supply, profile?.state);
  const supplyState = invoice.state_of_supply;

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
            <a className="secondary-button wa-btn" href={whatsappUrl} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            {canConvert && canCreate() && <button className="primary-button" type="button" onClick={handleConvert}>→ Convert</button>}
            {canPay && canCreate() && <button className="primary-button" type="button" onClick={() => setShowPayModal(true)}>💳 Payment</button>}
            {canEdit() && <button className="secondary-button" type="button" onClick={() => setEditNotes(!editNotes)}>✏️ Notes</button>}
          </div>
        }
      >
        <div className="invoice-detail-container" id="invoice-print-area">
          {message && <p className="form-message form-success no-print">{message}</p>}
          {error && <p className="form-message form-error no-print">{error}</p>}

          <div className="billbook-invoice-wrapper">
            <div className="invoice-theme-accent" />

            <div className="invoice-title-header">
              <div className="invoice-brand">
                <img 
                  src={profile?.logo_url || '/logo.png'} 
                  alt="" 
                  className="invoice-logo" 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <h1 className="business-name">{profile?.business_name || 'Business Name'}</h1>
                  {profile?.address && <p className="business-detail">{profile.address}</p>}
                  {profile?.gstin && <p className="business-detail"><strong>GSTIN:</strong> {profile.gstin}</p>}
                  {profile?.phone && <p className="business-detail"><strong>Phone:</strong> {profile.phone}</p>}
                  {profile?.email && <p className="business-detail"><strong>Email:</strong> {profile.email}</p>}
                </div>
              </div>
              <div className="invoice-meta-box">
                <h2 className="tax-invoice-title">{cfg.label?.toUpperCase() || 'TAX INVOICE'}</h2>
                <div className="meta-grid">
                  <span className="meta-label">Invoice No:</span>
                  <span className="meta-value"><strong>{invoice.invoice_no}</strong></span>
                  <span className="meta-label">Date:</span>
                  <span className="meta-value">{formatDate(invoice.date)}</span>
                  {invoice.due_date && (
                    <>
                      <span className="meta-label">Due Date:</span>
                      <span className="meta-value">{formatDate(invoice.due_date)}</span>
                    </>
                  )}
                  <span className="meta-label">Place of Supply:</span>
                  <span className="meta-value">{supplyState || 'Not Specified'}</span>
                </div>
                <div className="status-badge-container no-print">
                  <span className={`status-badge status-${invoice.status}`}>{invoice.status}</span>
                </div>
              </div>
            </div>

            <div className="invoice-parties-grid">
              <div className="party-card bill-to">
                <h3>BILL TO</h3>
                <p className="customer-name">{invoice.customers?.name || 'Walk-in Customer'}</p>
                {invoice.customers?.address && <p className="customer-detail"><strong>Address:</strong> {invoice.customers.address}</p>}
                {invoice.customers?.gstin && <p className="customer-detail"><strong>GSTIN:</strong> {invoice.customers.gstin}</p>}
                {invoice.customers?.phone && <p className="customer-detail"><strong>Phone:</strong> {invoice.customers.phone}</p>}
                {invoice.customers?.email && <p className="customer-detail"><strong>Email:</strong> {invoice.customers.email}</p>}
              </div>
              <div className="party-card ship-to">
                <h3>SHIP TO / DISPATCH DETAILS</h3>
                <p className="customer-name">{invoice.customers?.name || 'Walk-in Customer'}</p>
                {invoice.customers?.address && <p className="customer-detail"><strong>Address:</strong> {invoice.customers.address}</p>}
                <p className="customer-detail"><strong>State of Supply:</strong> {supplyState || 'Not Specified'}</p>
              </div>
            </div>

            <div className="invoice-table-container">
              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ textAlign: 'left' }}>Item Name / Description</th>
                    <th style={{ width: '80px' }}>HSN/SAC</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Rate/Unit</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Discount</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>GST %</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
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
                      <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td style={{ textAlign: 'left', fontWeight: '500' }}>{item.name}</td>
                        <td>{item.hsn || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty} {item.unit || 'Pcs'}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(item.price)}</td>
                        <td style={{ textAlign: 'right' }}>{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.gst}%</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmt(netRowAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="invoice-footer-grid">
              <div className="footer-left-col">
                <div className="amount-in-words">
                  <strong>Total in Words:</strong> <span className="words-text">{numberToWords(invoice.total)}</span>
                </div>

                {(profile?.bank_name || profile?.upi_id) && (
                  <div className="bank-details-box">
                    <h4>Bank Details</h4>
                    {profile.bank_name && (
                      <p><strong>Bank:</strong> {profile.bank_name} | <strong>A/c No:</strong> {profile.account_no} | <strong>IFSC:</strong> {profile.ifsc}</p>
                    )}
                    {profile.upi_id && <p><strong>UPI ID:</strong> {profile.upi_id}</p>}
                  </div>
                )}

                {profile?.terms && (
                  <div className="terms-box">
                    <h4>Terms & Conditions</h4>
                    <p>{profile.terms}</p>
                  </div>
                )}
              </div>

              <div className="footer-right-col">
                <div className="totals-summary-box">
                  <div className="summary-row"><span>Subtotal:</span><span>{fmt(invoice.subtotal)}</span></div>
                  {parseFloat(invoice.shipping_charges) > 0 && <div className="summary-row"><span>Shipping:</span><span>{fmt(invoice.shipping_charges)}</span></div>}
                  {parseFloat(invoice.discount) > 0 && <div className="summary-row"><span>Discount:</span><span>-{fmt(invoice.discount)}</span></div>}
                  {gstSplit.cgst > 0 && (
                    <>
                      <div className="summary-row"><span>CGST:</span><span>{fmt(gstSplit.cgst)}</span></div>
                      <div className="summary-row"><span>SGST:</span><span>{fmt(gstSplit.sgst)}</span></div>
                    </>
                  )}
                  {gstSplit.igst > 0 && <div className="summary-row"><span>IGST:</span><span>{fmt(gstSplit.igst)}</span></div>}
                  {parseFloat(invoice.round_off) !== 0 && <div className="summary-row"><span>Round Off:</span><span>{fmt(invoice.round_off)}</span></div>}
                  
                  <div className="summary-row grand-total-row">
                    <span>Grand Total:</span>
                    <span>{fmt(invoice.total)}</span>
                  </div>

                  {cfg.payment && (
                    <>
                      <div className="summary-row paid-row"><span>Paid:</span><span>{fmt(invoice.paid)}</span></div>
                      <div className="summary-row balance-row"><span>Balance Due:</span><span>{fmt(invoice.balance)}</span></div>
                    </>
                  )}
                </div>

                <div className="signature-box">
                  <div className="signature-line" />
                  <p>Authorized Signatory</p>
                  <p className="signature-biz-name">{profile?.business_name}</p>
                </div>
              </div>
            </div>
            
            <div className="thank-you-footer">
              <p>Thank you for your business!</p>
            </div>
          </div>

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
