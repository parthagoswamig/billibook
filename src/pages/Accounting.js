import React, { useEffect, useState } from 'react';
import { useRole } from '../lib/RoleContext';
import Pagination from '../components/Pagination';
import { 
  getCashBook, 
  getBankBook, 
  getDayBook, 
  getJournalEntries, 
  createManualJournalEntry,
  getTrialBalance,
  getChartOfAccounts
} from '../lib/db';
import { formatCurrency, formatDate } from '../lib/utils';
import './Accounting.css';

function Accounting() {
  const { tenantId, canCreate } = useRole();
  const [activeTab, setActiveTab] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cash Book States
  const [cashBook, setCashBook] = useState({ entries: [], totalIn: 0, totalOut: 0, balance: 0 });
  
  // Bank Book States
  const [bankBook, setBankBook] = useState({ entries: [], totalIn: 0, totalOut: 0, balance: 0 });

  // Day Book States
  const [dayBookEntries, setDayBookEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // General Ledger Journals States
  const [journals, setJournals] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;
  
  // Trial Balance State
  const [trialBalance, setTrialBalance] = useState({ accounts: [], totalDebits: 0, totalCredits: 0, isBalanced: true });
  
  // COA List for Dropdowns
  const [coaList, setCoaList] = useState([]);
  
  const [showManualJEModal, setShowManualJEModal] = useState(false);
  const [manualJEForm, setManualJEForm] = useState({
    date: new Date().toISOString().split('T')[0],
    entry_no: '',
    description: '',
    items: [
      { account_id: '', debit: '', credit: '' },
      { account_id: '', debit: '', credit: '' }
    ]
  });

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'cash') {
        const data = await getCashBook(tenantId);
        setCashBook(data);
      } else if (activeTab === 'bank') {
        const data = await getBankBook(tenantId);
        setBankBook(data);
      } else if (activeTab === 'day') {
        const data = await getDayBook(tenantId, selectedDate);
        setDayBookEntries(data);
      } else if (activeTab === 'journals') {
        const data = await getJournalEntries(tenantId, page, limit);
        setJournals(data || []);
        setTotalCount(data.totalCount || 0);
      } else if (activeTab === 'trial') {
        const data = await getTrialBalance(tenantId);
        setTrialBalance(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, activeTab, selectedDate, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    const loadCoa = async () => {
      if (!tenantId) return;
      try {
        const data = await getChartOfAccounts(tenantId);
        setCoaList(data || []);
      } catch (err) {
        console.error('Failed to load COA:', err);
      }
    };
    loadCoa();
  }, [tenantId]);

  const handleAddJEItem = () => {
    setManualJEForm(prev => ({
      ...prev,
      items: [...prev.items, { account_id: '', debit: '', credit: '' }]
    }));
  };

  const handleRemoveJEItem = (idx) => {
    setManualJEForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleJEItemChange = (idx, field, value) => {
    setManualJEForm(prev => {
      const newItems = [...prev.items];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleJESubmit = async (e) => {
    e.preventDefault();
    if (!canCreate()) {
      setError('Permission denied: You do not have access to record accounting entries.');
      return;
    }

    const validItems = manualJEForm.items.filter(item => item.account_id);
    if (validItems.length < 2) {
      setError('A manual journal entry must contain at least 2 accounts.');
      return;
    }

    const totalDebit = validItems.reduce((sum, i) => sum + (parseFloat(i.debit) || 0), 0);
    const totalCredit = validItems.reduce((sum, i) => sum + (parseFloat(i.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setError(`Double-entry balance check failed: Total Debits (${formatCurrency(totalDebit)}) must equal Total Credits (${formatCurrency(totalCredit)}). Diff: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`);
      return;
    }

    try {
      setError('');
      await createManualJournalEntry(tenantId, {
        date: manualJEForm.date,
        entry_no: manualJEForm.entry_no || undefined,
        description: manualJEForm.description
      }, validItems);
      setSuccessMsg('Manual Journal Entry recorded successfully');
      setShowManualJEModal(false);
      setManualJEForm({
        date: new Date().toISOString().split('T')[0],
        entry_no: '',
        description: '',
        items: [
          { account_id: '', debit: '', credit: '' },
          { account_id: '', debit: '', credit: '' }
        ]
      });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to record manual journal entry');
    }
  };

  const computeJEManualTotals = () => {
    const totalDebit = manualJEForm.items.reduce((sum, i) => sum + (parseFloat(i.debit) || 0), 0);
    const totalCredit = manualJEForm.items.reduce((sum, i) => sum + (parseFloat(i.credit) || 0), 0);
    return { totalDebit, totalCredit };
  };

  const { totalDebit: formDebitSum, totalCredit: formCreditSum } = computeJEManualTotals();

  const exportTrialBalanceCSV = () => {
    if (!trialBalance.accounts || trialBalance.accounts.length === 0) return;
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Account Code,Account Name,Type,Debit Balance,Credit Balance\r\n';
    
    trialBalance.accounts.forEach(acc => {
      const debitVal = acc.debitBalance > 0 ? acc.debitBalance.toFixed(2) : '0.00';
      const creditVal = acc.creditBalance > 0 ? acc.creditBalance.toFixed(2) : '0.00';
      csvContent += `"${acc.code}","${acc.name}","${acc.type}",${debitVal},${creditVal}\r\n`;
    });
    
    csvContent += `"","Grand Total","",${trialBalance.totalDebits.toFixed(2)},${trialBalance.totalCredits.toFixed(2)}\r\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trial_balance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="accounting-container">
      {/* Header */}
      <div className="accounting-header">
        <div className="accounting-header-title">
          <h2>🏦 Accounting Console</h2>
          <p>Analyze cash flows, bank books, daily journals, and double-entry general ledgers.</p>
        </div>
        <button 
          className="btn-inventory" 
          style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
          onClick={loadData}
        >
          🔄 Refresh
        </button>
      </div>

      {successMsg && <div className="form-message form-success" style={{ marginBottom: '20px' }}>{successMsg}</div>}
      {error && <div className="form-message form-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Tabs */}
      <div className="accounting-tabs">
        <button 
          className={`accounting-tab-btn ${activeTab === 'cash' ? 'active' : ''}`}
          onClick={() => setActiveTab('cash')}
        >
          💵 Cash Book
        </button>
        <button 
          className={`accounting-tab-btn ${activeTab === 'bank' ? 'active' : ''}`}
          onClick={() => setActiveTab('bank')}
        >
          🏦 Bank & Digital Book
        </button>
        <button 
          className={`accounting-tab-btn ${activeTab === 'day' ? 'active' : ''}`}
          onClick={() => setActiveTab('day')}
        >
          📅 Day Book
        </button>
        <button 
          className={`accounting-tab-btn ${activeTab === 'journals' ? 'active' : ''}`}
          onClick={() => setActiveTab('journals')}
        >
          📖 General Ledger Journals
        </button>
        <button 
          className={`accounting-tab-btn ${activeTab === 'trial' ? 'active' : ''}`}
          onClick={() => setActiveTab('trial')}
        >
          ⚖️ Trial Balance
        </button>
      </div>

      {/* Cash Book Tab */}
      {activeTab === 'cash' && (
        <>
          <div className="accounting-summary-bar">
            <div className="summary-indicator-card">
              <div className="indicator-title">Total Cash Inflow</div>
              <div className="indicator-value green">{formatCurrency(cashBook.totalIn)}</div>
            </div>
            <div className="summary-indicator-card">
              <div className="indicator-title">Total Cash Outflow</div>
              <div className="indicator-value red">{formatCurrency(cashBook.totalOut)}</div>
            </div>
            <div className="summary-indicator-card">
              <div className="indicator-title">Net Cash Balance</div>
              <div className={`indicator-value ${cashBook.balance >= 0 ? 'green' : 'red'}`}>
                {formatCurrency(cashBook.balance)}
              </div>
            </div>
          </div>

          <div className="accounting-card">
            <div className="book-title-row">
              <h3>Cash Transaction Journal</h3>
            </div>
            
            {loading ? (
              <div className="empty-state">Loading Cash Book...</div>
            ) : cashBook.entries.length === 0 ? (
              <div className="empty-state">No cash transactions logged yet.</div>
            ) : (
              <div className="simple-table-wrapper">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref/Doc</th>
                      <th>Category</th>
                      <th>Party Name</th>
                      <th>Cash In (+)</th>
                      <th>Cash Out (-)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashBook.entries.map((entry, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(entry.date)}</td>
                        <td><strong>{entry.ref || '—'}</strong></td>
                        <td>{entry.category}</td>
                        <td>{entry.party}</td>
                        <td className="cash-in-color">
                          {entry.type === 'in' ? formatCurrency(entry.amount) : '—'}
                        </td>
                        <td className="cash-out-color">
                          {entry.type === 'out' ? formatCurrency(entry.amount) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bank & Digital Book Tab */}
      {activeTab === 'bank' && (
        <>
          <div className="accounting-summary-bar">
            <div className="summary-indicator-card">
              <div className="indicator-title">Total Bank Inflow</div>
              <div className="indicator-value green">{formatCurrency(bankBook.totalIn)}</div>
            </div>
            <div className="summary-indicator-card">
              <div className="indicator-title">Total Bank Outflow</div>
              <div className="indicator-value red">{formatCurrency(bankBook.totalOut)}</div>
            </div>
            <div className="summary-indicator-card">
              <div className="indicator-title">Net Bank Balance</div>
              <div className={`indicator-value ${bankBook.balance >= 0 ? 'green' : 'red'}`}>
                {formatCurrency(bankBook.balance)}
              </div>
            </div>
          </div>

          <div className="accounting-card">
            <div className="book-title-row">
              <h3>Bank & Digital Payments Journal</h3>
            </div>
            
            {loading ? (
              <div className="empty-state">Loading Bank Book...</div>
            ) : bankBook.entries.length === 0 ? (
              <div className="empty-state">No bank or digital transactions logged yet.</div>
            ) : (
              <div className="simple-table-wrapper">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref/Doc</th>
                      <th>Category</th>
                      <th>Party Name</th>
                      <th>Payment Mode</th>
                      <th>Inflow (+)</th>
                      <th>Outflow (-)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankBook.entries.map((entry, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(entry.date)}</td>
                        <td><strong>{entry.ref || '—'}</strong></td>
                        <td>{entry.category}</td>
                        <td>{entry.party}</td>
                        <td><span className="badge badge-success">{entry.mode}</span></td>
                        <td className="cash-in-color">
                          {entry.type === 'in' ? formatCurrency(entry.amount) : '—'}
                        </td>
                        <td className="cash-out-color">
                          {entry.type === 'out' ? formatCurrency(entry.amount) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Day Book Tab */}
      {activeTab === 'day' && (
        <div className="accounting-card">
          <div className="book-title-row">
            <h3>Daily General Ledger Journal</h3>
            <input 
              type="date"
              className="filter-date-picker"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty-state">Loading Day Book...</div>
          ) : dayBookEntries.length === 0 ? (
            <div className="empty-state">No transactions recorded on {formatDate(selectedDate)}.</div>
          ) : (
            <div className="simple-table-wrapper">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Ref/Doc</th>
                    <th>Type</th>
                    <th>Particulars / Details</th>
                    <th>Party Name</th>
                    <th>Flow</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBookEntries.map((entry, idx) => (
                    <tr key={idx}>
                      <td><strong>{entry.ref}</strong></td>
                      <td><span className="badge badge-warning">{entry.type}</span></td>
                      <td>{entry.detail}</td>
                      <td>{entry.party}</td>
                      <td>
                        <span className={entry.flow === 'in' ? 'flow-in' : 'flow-out'}>
                          {entry.flow === 'in' ? 'INFLOW' : 'OUTFLOW'}
                        </span>
                      </td>
                      <td className={entry.flow === 'in' ? 'cash-in-color' : 'cash-out-color'}>
                        {formatCurrency(entry.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* General Ledger Journals Tab */}
      {activeTab === 'journals' && (
        <div className="accounting-card">
          <div className="book-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Double Entry General Ledger Journals</h3>
            {canCreate() && (
              <button 
                type="button" 
                className="btn-inventory"
                style={{ background: 'var(--accent)', color: 'white' }}
                onClick={() => setShowManualJEModal(true)}
              >
                + New Journal Entry
              </button>
            )}
          </div>

          {loading ? (
            <div className="empty-state">Loading journals...</div>
          ) : journals.length === 0 ? (
            <div className="empty-state">No journal entries recorded.</div>
          ) : (
            <div className="journals-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {journals.map((je) => (
                <div key={je.id} className="journal-entry-card" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '16px', background: 'var(--background)' }}>
                  <div className="je-header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{je.entry_no}</strong>
                      <span style={{ marginLeft: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>📅 {formatDate(je.date)}</span>
                    </div>
                    <div>
                      <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '10px' }}>{je.reference_type}</span>
                    </div>
                  </div>
                  
                  <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '12px' }}><strong>Description:</strong> {je.description || '—'}</p>

                  <div className="simple-table-wrapper">
                    <table className="simple-table" style={{ fontSize: '12.5px' }}>
                      <thead>
                        <tr>
                          <th>Account Head</th>
                          <th style={{ textAlign: 'right', width: '20%' }}>Debit</th>
                          <th style={{ textAlign: 'right', width: '20%' }}>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {je.journal_items?.map((item) => (
                          <tr key={item.id}>
                            <td style={{ paddingLeft: parseFloat(item.credit) > 0 ? '24px' : '8px', fontStyle: parseFloat(item.credit) > 0 ? 'italic' : 'normal' }}>
                              {parseFloat(item.credit) > 0 ? 'To ' : ''}{item.account_name}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: parseFloat(item.debit) > 0 ? '600' : 'normal' }}>
                              {parseFloat(item.debit) > 0 ? formatCurrency(item.debit) : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: parseFloat(item.credit) > 0 ? '600' : 'normal' }}>
                              {parseFloat(item.credit) > 0 ? formatCurrency(item.credit) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <Pagination 
                page={page} 
                limit={limit} 
                totalCount={totalCount} 
                onChangePage={(p) => setPage(p)} 
              />
            </div>
          )}
        </div>
      )}

      {/* Trial Balance Tab */}
      {activeTab === 'trial' && (
        <>
          <div className="accounting-summary-bar">
            <div className="summary-indicator-card">
              <div className="indicator-title">Total Debits</div>
              <div className="indicator-value green">{formatCurrency(trialBalance.totalDebits)}</div>
            </div>
            <div className="summary-indicator-card">
              <div className="indicator-title">Total Credits</div>
              <div className="indicator-value green">{formatCurrency(trialBalance.totalCredits)}</div>
            </div>
            <div className="summary-indicator-card">
              <div className="indicator-title">Ledger Status</div>
              <div className={`indicator-value ${trialBalance.isBalanced ? 'green' : 'red'}`}>
                {trialBalance.isBalanced ? '⚖️ Balanced' : '⚠️ Unbalanced'}
              </div>
            </div>
          </div>

          <div className="accounting-card">
            <div className="book-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Trial Balance Sheet</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn-inventory"
                  style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={exportTrialBalanceCSV}
                >
                  📥 Export CSV
                </button>
                <button 
                  type="button" 
                  className="btn-inventory"
                  style={{ background: 'var(--accent)', color: 'white' }}
                  onClick={() => window.print()}
                >
                  🖨️ Print PDF
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">Loading Trial Balance...</div>
            ) : trialBalance.accounts.length === 0 ? (
              <div className="empty-state">No balances to display.</div>
            ) : (
              <div className="simple-table-wrapper printable-area">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Account Code</th>
                      <th>Account Name</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Debit Balance</th>
                      <th style={{ textAlign: 'right' }}>Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.accounts.map((acc) => (
                      <tr key={acc.id}>
                        <td><strong>{acc.code}</strong></td>
                        <td>{acc.name}</td>
                        <td><span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>{acc.type}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: acc.debitBalance > 0 ? '600' : 'normal' }}>
                          {acc.debitBalance > 0 ? formatCurrency(acc.debitBalance) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: acc.creditBalance > 0 ? '600' : 'normal' }}>
                          {acc.creditBalance > 0 ? formatCurrency(acc.creditBalance) : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)', background: '#F8FAFC' }}>
                      <td colSpan="3">Grand Total</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)' }}>
                        {formatCurrency(trialBalance.totalDebits)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)' }}>
                        {formatCurrency(trialBalance.totalCredits)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Manual Journal Entry Modal */}
      {showManualJEModal && (
        <div className="modal-overlay" onClick={() => setShowManualJEModal(false)}>
          <div className="modal-content modal-extra-wide" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New General Journal Entry</h3>
              <button className="modal-close" type="button" onClick={() => setShowManualJEModal(false)}>✕</button>
            </div>
            <form onSubmit={handleJESubmit} className="modal-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <label className="form-label">
                  <span>Entry Date *</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={manualJEForm.date} 
                    onChange={(e) => setManualJEForm({ ...manualJEForm, date: e.target.value })} 
                    required 
                  />
                </label>
                <label className="form-label">
                  <span>Journal Entry No. (Optional)</span>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. JV-MAN-001" 
                    value={manualJEForm.entry_no} 
                    onChange={(e) => setManualJEForm({ ...manualJEForm, entry_no: e.target.value })} 
                  />
                </label>
              </div>

              <label className="form-label" style={{ marginBottom: '20px' }}>
                <span>Description / Particulars *</span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Describe the purpose of this manual entry" 
                  value={manualJEForm.description} 
                  onChange={(e) => setManualJEForm({ ...manualJEForm, description: e.target.value })} 
                  required 
                />
              </label>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4>Journal Accounts List</h4>
                  <button type="button" className="secondary-button" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={handleAddJEItem}>
                    + Add Account Line
                  </button>
                </div>
                
                <table className="spreadsheet-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>Account Head / Ledger</th>
                      <th style={{ width: '22%' }}>Debit</th>
                      <th style={{ width: '22%' }}>Credit</th>
                      <th style={{ width: '6%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualJEForm.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <select 
                            className="spreadsheet-input" 
                            value={item.account_id} 
                            onChange={(e) => handleJEItemChange(idx, 'account_id', e.target.value)} 
                            required 
                          >
                            <option value="">-- Select Account --</option>
                            {coaList.map((coa) => (
                              <option key={coa.id} value={coa.id}>
                                {coa.code} - {coa.name} ({coa.type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="spreadsheet-input" 
                            placeholder="0.00" 
                            value={item.debit} 
                            disabled={!!item.credit}
                            onChange={(e) => handleJEItemChange(idx, 'debit', e.target.value)} 
                            min="0" 
                            step="0.01" 
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="spreadsheet-input" 
                            placeholder="0.00" 
                            value={item.credit} 
                            disabled={!!item.debit}
                            onChange={(e) => handleJEItemChange(idx, 'credit', e.target.value)} 
                            min="0" 
                            step="0.01" 
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {manualJEForm.items.length > 2 && (
                            <button type="button" className="remove-item-btn" onClick={() => handleRemoveJEItem(idx)}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Validation and Totals display */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', fontSize: '14px', fontWeight: '700' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: '#f8fafc', padding: '12px 24px', borderRadius: '6px' }}>
                    <span style={{ color: formDebitSum === formCreditSum && formDebitSum > 0 ? '#10B981' : '#EF4444' }}>
                      Total Debits: {formatCurrency(formDebitSum)}
                    </span>
                    <span style={{ color: formDebitSum === formCreditSum && formDebitSum > 0 ? '#10B981' : '#EF4444' }}>
                      Total Credits: {formatCurrency(formCreditSum)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowManualJEModal(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={formDebitSum !== formCreditSum || formDebitSum === 0}>
                  💾 Record Journal Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Accounting;
