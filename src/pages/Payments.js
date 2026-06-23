import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSection from '../components/PageSection';
import Pagination from '../components/Pagination';
import { supabase } from '../db';
import { useUser } from '../lib/useUser';
import { 
  getInvoices, 
  getAllPayments, 
  getParties, 
  recordBulkPayment, 
  syncOverdueStatuses,
  reversePayment
} from '../lib/db';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { formatCurrency, formatDate, PAYMENT_MODES, buildWhatsAppUrl } from '../lib/utils';
import './Payments.css';

function Payments() {
  const { userId, loading: userLoading } = useUser();
  const { tenantId } = useRole();
  const { currency } = useBusiness();
  const navigate = useNavigate();
  
  // Data states
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // UI filter states
  const [activeMode, setActiveMode] = useState('inflow'); // 'inflow' (receipt) or 'outflow' (payment)
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Form states
  const [form, setForm] = useState({ customerId: '', amount: '', payment_mode: 'Cash', note: '', allocations: {} });
  const [partyInvoices, setPartyInvoices] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Pagination states
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotalCount, setInvoiceTotalCount] = useState(0);
  const invoiceLimit = 50;

  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalCount, setPaymentsTotalCount] = useState(0);
  const paymentsLimit = 50;

  // KPI & Tab states
  const [kpiTotalPaid, setKpiTotalPaid] = useState(0);
  const [kpiTotalPending, setKpiTotalPending] = useState(0);
  const [tabCounts, setTabCounts] = useState({ all: 0, unpaid: 0, partial: 0, paid: 0, overdue: 0 });

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      await syncOverdueStatuses(tenantId);
      
      const type = activeMode === 'inflow' ? 'sale' : 'purchase';
      const kind = activeMode === 'inflow' ? 'sale_invoice' : 'purchase_bill';
      const partyType = activeMode === 'inflow' ? 'customer' : 'supplier';
      
      // Load paginated data & static parties
      const [invs, pays, pts] = await Promise.all([
        getInvoices(tenantId, type, kind, invoicePage, invoiceLimit, '', filterStatus),
        getAllPayments(tenantId, paymentsPage, paymentsLimit, '', partyType),
        getParties(tenantId, partyType)
      ]);
      
      if (activeMode === 'inflow') {
        setSalesInvoices(invs || []);
        setCustomers(pts || []);
      } else {
        setPurchaseBills(invs || []);
        setSuppliers(pts || []);
      }
      setInvoiceTotalCount(invs.totalCount || 0);
      setPayments(pays || []);
      setPaymentsTotalCount(pays.totalCount || 0);

      // Async KPI Calculations
      const [paidRes, pendingRes, countsRes] = await Promise.all([
        supabase
          .from('invoice_payments')
          .select('amount, customers!inner(type)')
          .eq('user_id', tenantId)
          .eq('customers.type', partyType)
          .neq('status', 'reversed'),
        supabase
          .from('invoices')
          .select('balance')
          .eq('user_id', tenantId)
          .eq('type', type)
          .eq('document_kind', kind),
        supabase
          .from('invoices')
          .select('status')
          .eq('user_id', tenantId)
          .eq('type', type)
          .eq('document_kind', kind)
      ]);

      if (!paidRes.error && paidRes.data) {
        setKpiTotalPaid(paidRes.data.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0));
      }
      if (!pendingRes.error && pendingRes.data) {
        setKpiTotalPending(pendingRes.data.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0));
      }
      if (!countsRes.error && countsRes.data) {
        const counts = { all: 0, unpaid: 0, partial: 0, paid: 0, overdue: 0 };
        countsRes.data.forEach((i) => {
          counts.all++;
          if (counts[i.status] !== undefined) counts[i.status]++;
        });
        setTabCounts(counts);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId, activeMode, filterStatus, invoicePage, paymentsPage]);

  // Reset page numbers on tab changes
  useEffect(() => {
    setInvoicePage(1);
    setPaymentsPage(1);
  }, [activeMode, filterStatus]);

  const activeInvoices = activeMode === 'inflow' ? salesInvoices : purchaseBills;
  const activeParties = activeMode === 'inflow' ? customers : suppliers;
  const activePayments = payments; // Already filtered on server side

  const handlePartyChange = async (partyId) => {
    setForm(f => ({ ...f, customerId: partyId, allocations: {} }));
    if (partyId) {
      try {
        const type = activeMode === 'inflow' ? 'sale' : 'purchase';
        const kind = activeMode === 'inflow' ? 'sale_invoice' : 'purchase_bill';
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', tenantId)
          .eq('customer_id', partyId)
          .eq('type', type)
          .eq('document_kind', kind)
          .neq('status', 'paid')
          .order('date', { ascending: true });
        if (error) throw error;
        setPartyInvoices(data || []);
      } catch (err) {
        console.error('Failed to load unpaid invoices for party allocation:', err);
        setPartyInvoices([]);
      }
    } else {
      setPartyInvoices([]);
    }
  };

  const handleAllocationChange = (invoiceId, val) => {
    const amt = parseFloat(val) || 0;
    setForm(f => ({
      ...f,
      allocations: {
        ...f.allocations,
        [invoiceId]: amt
      }
    }));
  };

  const handleAutoAllocate = () => {
    const totalAmt = parseFloat(form.amount) || 0;
    if (totalAmt <= 0) return;
    
    let remaining = totalAmt;
    const newAllocations = {};
    
    // Sort invoices oldest first (FIFO)
    const sorted = [...partyInvoices].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const inv of sorted) {
      const bal = parseFloat(inv.balance || inv.total - inv.paid);
      if (remaining <= 0) {
        newAllocations[inv.id] = 0;
      } else if (remaining >= bal) {
        newAllocations[inv.id] = bal;
        remaining -= bal;
      } else {
        newAllocations[inv.id] = remaining;
        remaining = 0;
      }
    }
    
    setForm(f => ({ ...f, allocations: newAllocations }));
  };

  const totalAllocated = Object.values(form.allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerId || !form.amount) { setError('Select a party and enter total amount'); return; }
    
    const paymentAmt = parseFloat(form.amount);
    if (totalAllocated > paymentAmt + 0.01) {
      setError(`Allocated amount (${fmt(totalAllocated)}) cannot exceed total payment amount (${fmt(paymentAmt)})`);
      return;
    }

    try {
      const allocationArray = Object.entries(form.allocations)
        .filter(([_, amt]) => parseFloat(amt) > 0)
        .map(([invId, amt]) => ({ invoiceId: invId, amount: parseFloat(amt) }));

      await recordBulkPayment(tenantId, form.customerId, paymentAmt, form.payment_mode, form.note, allocationArray);
      
      setShowModal(false);
      setForm({ customerId: '', amount: '', payment_mode: 'Cash', note: '', allocations: {} });
      setPartyInvoices([]);
      setMessage('✓ Payment recorded successfully');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReversePayment = async (paymentId) => {
    const reason = window.prompt('Enter reason for reversing this payment:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Reversal reason is required.');
      return;
    }
    try {
      setError('');
      await reversePayment(paymentId, reason);
      setMessage('✓ Payment reversed successfully');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message || 'Failed to reverse payment');
    }
  };

  const fmt = (n) => formatCurrency(n, currency);
  const filtered = activeInvoices; // Already filtered on server side
  const totalPaid = kpiTotalPaid;
  const totalPending = kpiTotalPending;
  const remindUrl = (inv) => buildWhatsAppUrl(inv.customers?.phone,
    `Payment reminder: Invoice ${inv.invoice_no}, balance ${fmt(inv.balance)}, due ${formatDate(inv.due_date)}`);

  return (
    <>
      <PageSection
        eyebrow="Accounting"
        title="Payments"
        description="Record and track customer payments and supplier balances."
        actions={
          <button 
            className="primary-button" 
            type="button" 
            onClick={() => { 
              setForm({ customerId: '', amount: '', payment_mode: 'Cash', note: '', allocations: {} }); 
              setPartyInvoices([]); 
              setShowModal(true); 
              setError(''); 
            }}
          >
            {activeMode === 'inflow' ? '+ Record receipt' : '+ Record payment'}
          </button>
        }
      >
        <div className="payments-container">
          {message && <p className="form-message form-success">{message}</p>}
          {error && !showModal && <p className="form-message form-error">{error}</p>}

          {/* Dual-Tab Mode Switcher */}
          <div className="payments-mode-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button 
              className={`tab-btn ${activeMode === 'inflow' ? 'active' : ''}`}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '6px',
                border: 'none',
                background: activeMode === 'inflow' ? 'var(--accent)' : 'var(--border)',
                color: activeMode === 'inflow' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => { setActiveMode('inflow'); setFilterStatus('all'); }}
            >
              📥 Customer Receipts
            </button>
            <button 
              className={`tab-btn ${activeMode === 'outflow' ? 'active' : ''}`}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '6px',
                border: 'none',
                background: activeMode === 'outflow' ? 'var(--accent)' : 'var(--border)',
                color: activeMode === 'outflow' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => { setActiveMode('outflow'); setFilterStatus('all'); }}
            >
              📤 Supplier Payments
            </button>
          </div>

          <div className="payment-stats">
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <p className="stat-label">{activeMode === 'inflow' ? 'Total Received' : 'Total Paid Out'}</p>
                <p className="stat-value">{fmt(totalPaid)}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <p className="stat-label">Pending</p>
                <p className="stat-value">{fmt(totalPending)}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <p className="stat-label">{activeMode === 'inflow' ? 'Invoices' : 'Purchase Bills'}</p>
                <p className="stat-value">{tabCounts.all}</p>
              </div>
            </div>
          </div>

          <div className="filter-tabs">
            {['all', 'unpaid', 'partial', 'paid', 'overdue'].map((s) => (
              <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} type="button" onClick={() => setFilterStatus(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)} ({tabCounts[s] || 0})
              </button>
            ))}
          </div>

          {loading || userLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <div className="invoice-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="invoice-list">
                <div className="list-header">
                  <div className="col-invoice">{activeMode === 'inflow' ? 'Invoice' : 'Bill No'}</div>
                  <div className="col-customer">{activeMode === 'inflow' ? 'Customer' : 'Supplier'}</div>
                  <div className="col-amount">Total</div>
                  <div className="col-paid">{activeMode === 'inflow' ? 'Paid' : 'Settled'}</div>
                  <div className="col-status">Status</div>
                  <div className="col-action">Action</div>
                </div>
                {filtered.map((inv) => (
                  <div key={inv.id} className="list-row">
                    <div className="col-invoice">{inv.invoice_no}</div>
                    <div className="col-customer">{inv.customers?.name || '—'}</div>
                    <div className="col-amount">{fmt(inv.total)}</div>
                    <div className="col-paid">{fmt(inv.paid)}</div>
                    <div className="col-status"><span className={`status-badge status-${inv.status}`}>{inv.status}</span></div>
                    <div className="col-action">
                      {inv.status !== 'paid' && (
                        <>
                          <button 
                            className="action-btn record-btn" 
                            type="button" 
                            onClick={() => { 
                              setForm({ 
                                customerId: inv.customer_id, 
                                amount: (inv.balance || inv.total).toString(), 
                                payment_mode: 'Cash', 
                                note: '', 
                                allocations: { [inv.id]: parseFloat(inv.balance || inv.total) } 
                              }); 
                              setPartyInvoices([inv]); 
                              setShowModal(true); 
                            }}
                          >
                            Settle
                          </button>
                          {activeMode === 'inflow' && inv.customers?.phone && (
                            <a className="action-btn wa-btn" href={remindUrl(inv)} target="_blank" rel="noreferrer">Remind</a>
                          )}
                        </>
                      )}
                      <button className="action-btn" type="button" onClick={() => navigate(`/invoices/${inv.id}`)}>View</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination 
                page={invoicePage} 
                limit={invoiceLimit} 
                totalCount={invoiceTotalCount} 
                onChangePage={(p) => setInvoicePage(p)} 
              />
            </div>
          )}

          <div className="payment-history">
            <h3>{activeMode === 'inflow' ? 'Collection History' : 'Payment Disbursal History'}</h3>
            <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activePayments.length === 0 ? (
                <div className="empty-history">No history logged yet</div>
              ) : (
                <>
                  {activePayments.map((p) => {
                    const invoicesDisplay = p.invoices?.invoice_no || 
                      p.payment_allocations?.map(a => a.invoices?.invoice_no).filter(Boolean).join(', ') || 
                      'Bulk Allocation';
                    const customerDisplay = p.customers?.name || 
                      p.invoices?.customers?.name || 
                      p.payment_allocations?.[0]?.invoices?.customers?.name || 
                      'Walk-in';
                    const isReversed = p.status === 'reversed';
                    return (
                      <div key={p.id} className={`history-item ${isReversed ? 'history-item-reversed' : ''}`} style={{ opacity: isReversed ? 0.6 : 1 }}>
                        <div className="history-header">
                          <div className="history-invoice" style={{ textDecoration: isReversed ? 'line-through' : 'none' }}>{invoicesDisplay}</div>
                          <div className="history-date">{formatDate(p.created_at)}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px 0' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            👤 {customerDisplay}
                          </div>
                          {isReversed && (
                            <span 
                              style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'var(--danger)',
                                background: '#FEE2E2',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              Reversed
                            </span>
                          )}
                        </div>
                        <div className="history-details" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span className="method-badge">{p.payment_mode}</span>
                            <span className="amount" style={{ textDecoration: isReversed ? 'line-through' : 'none' }}>{fmt(p.amount)}</span>
                            {p.note && <span className="notes">{p.note}</span>}
                            {isReversed && p.reversal_reason && (
                              <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
                                Reversal Reason: {p.reversal_reason}
                              </div>
                            )}
                          </div>
                          {!isReversed && (
                            <button 
                              className="action-btn"
                              style={{ 
                                background: '#DC2626', 
                                color: 'white', 
                                border: 'none', 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                cursor: 'pointer', 
                                fontSize: '11px' 
                              }}
                              onClick={() => handleReversePayment(p.id)}
                            >
                              Reverse
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Pagination 
                    page={paymentsPage} 
                    limit={paymentsLimit} 
                    totalCount={paymentsTotalCount} 
                    onChangePage={(p) => setPaymentsPage(p)} 
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </PageSection>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{activeMode === 'inflow' ? 'Record Payment Received' : 'Record Payment Made'}</h3>
              <button className="modal-close" type="button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {error && <p className="form-message form-error">{error}</p>}
              <label className="form-label">
                <span>{activeMode === 'inflow' ? 'Customer *' : 'Supplier *'}</span>
                <select className="form-input" value={form.customerId} onChange={(e) => handlePartyChange(e.target.value)} required>
                  <option value="">Select party</option>
                  {activeParties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>{activeMode === 'inflow' ? 'Amount Received *' : 'Amount Paid *'} ({currency})</span>
                <input type="number" className="form-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} step="0.01" min="0.01" required />
              </label>

              {partyInvoices.length > 0 && (
                <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {activeMode === 'inflow' ? 'Allocate to Invoices' : 'Allocate to Bills'}
                    </span>
                    <button 
                      type="button" 
                      className="secondary-button" 
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={handleAutoAllocate}
                    >
                      ⚡ Auto-Allocate (FIFO)
                    </button>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E8ECFF', borderRadius: '8px', padding: '8px' }}>
                    {partyInvoices.map((inv) => {
                      const bal = parseFloat(inv.balance || inv.total - inv.paid);
                      const allocatedVal = form.allocations[inv.id] || '';
                      return (
                        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                          <div style={{ fontSize: '12px', textAlign: 'left' }}>
                            <strong>{inv.invoice_no}</strong> ({formatDate(inv.date)})<br />
                            <span style={{ color: '#64748B', fontSize: '11px' }}>Total: {fmt(inv.total)} | Bal: {fmt(bal)}</span>
                          </div>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: '100px', padding: '4px 8px', fontSize: '12px', margin: 0 }}
                            placeholder="0.00"
                            value={allocatedVal}
                            max={bal}
                            step="0.01"
                            onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '11.5px', marginTop: '6px', textAlign: 'right', fontWeight: '600', color: Math.abs(totalAllocated - parseFloat(form.amount || 0)) < 0.01 ? '#10B981' : '#EF4444' }}>
                    Total Allocated: {fmt(totalAllocated)} / {fmt(parseFloat(form.amount) || 0)}
                  </div>
                </div>
              )}

              <label className="form-label"><span>Payment mode</span>
                <select className="form-input" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="form-label"><span>Notes</span>
                <textarea className="form-input" rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Payments;
