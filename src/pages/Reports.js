import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { 
  getReportsSummary, 
  getGstr1Summary, 
  getProducts,
  getBalanceSheetData,
  getCashFlowStatement
} from '../lib/db';
import { formatCurrency, exportToCSV } from '../lib/utils';

function Reports() {
  const { userId, loading: userLoading } = useUser();
  const { tenantId } = useRole();
  const { currency } = useBusiness();
  const [report, setReport] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState({
    receivables: 0,
    payables: 0,
    inventoryValue: 0,
    cash: 0,
    bank: 0,
    cgstInput: 0, sgstInput: 0, igstInput: 0, gstInputTotal: 0,
    cgstOutput: 0, sgstOutput: 0, igstOutput: 0, gstOutputTotal: 0,
    openingBalanceEquity: 0,
    retainedEarnings: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    equity: 0,
    totalLiabilitiesAndEquity: 0
  });
  const [cashFlow, setCashFlow] = useState({
    customerReceipts: 0,
    supplierPayments: 0,
    operatingExpenses: 0,
    otherInflows: 0,
    otherOutflows: 0,
    netOperatingCash: 0,
    netOtherCash: 0,
    netIncrease: 0
  });
  const [categoryValuation, setCategoryValuation] = useState({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const fmt = (n) => formatCurrency(n, currency);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [summary, bsData, cfData] = await Promise.all([
        getReportsSummary(tenantId, from || null, to || null),
        getBalanceSheetData(tenantId, to || null),
        getCashFlowStatement(tenantId, from || null, to || null)
      ]);
      
      setReport(summary);
      setBalanceSheet(bsData);
      setCashFlow(cfData);

      // Compute Category wise valuation
      const prods = await getProducts(tenantId);
      const catMetrics = {};
      for (const p of prods || []) {
        const catName = p.product_categories?.name || 'Uncategorized';
        if (!catMetrics[catName]) {
          catMetrics[catName] = { count: 0, stock: 0, valuation: 0 };
        }
        const stock = parseFloat(p.stock) || 0;
        const cost = parseFloat(p.purchase_price) || 0;
        catMetrics[catName].count += 1;
        catMetrics[catName].stock += stock;
        catMetrics[catName].valuation += (stock * cost);
      }
      setCategoryValuation(catMetrics);
    } catch (err) {
      console.error('Error loading reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, from, to]);

  const exportGstr1 = async () => {
    if (!tenantId) return;
    const data = await getGstr1Summary(tenantId, from || null, to || null);
    exportToCSV('GSTR-1.csv', ['Invoice', 'Date', 'Party', 'GSTIN', 'Taxable', 'GST', 'Total'],
      data.map((i) => [i.invoice_no, i.date, i.customers?.name, i.customers?.gstin, i.subtotal, i.gst_amount, i.total]));
  };

  const exportHsn = () => {
    exportToCSV('HSN-summary.csv', ['HSN', 'Qty', 'Taxable', 'GST'],
      Object.entries(report?.hsnSummary || {}).map(([hsn, v]) => [hsn, v.qty, v.taxable, v.gst]));
  };

  if (loading || userLoading) return <div className="loading-screen">Loading reports...</div>;

  const isNetProfitPositive = (report?.netProfit || 0) >= 0;

  // Accents for GST Summary Cards
  const gstCards = [
    { rate: '0%', color: '#94A3B8', value: fmt(0) },
    { rate: '5%', color: '#60A5FA', value: fmt((report?.totalSales || 0) * 0.05) },
    { rate: '12%', color: '#34D399', value: fmt((report?.totalSales || 0) * 0.12) },
    { rate: '18%', color: '#F59E0B', value: fmt(report?.totalGstCollected || 0) },
    { rate: '28%', color: '#EF4444', value: fmt((report?.totalSales || 0) * 0.28) },
  ];

  return (
    <PageSection eyebrow="Analytics" title="Reports & GST" description="GSTR-1 style reports, P&L, HSN summary."
      actions={<>
        <input type="date" className="form-input date-filter" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="form-input date-filter" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="secondary-button" type="button" onClick={exportGstr1}>📥 GSTR-1</button>
        <button className="secondary-button" type="button" onClick={exportHsn}>📥 HSN</button>
      </>}
    >
      {/* Premium P&L Box */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A, #1E293B)',
        borderRadius: '16px',
        padding: '28px',
        color: 'white',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '24px',
        marginBottom: '28px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sales</span>
          <span style={{ fontSize: '24px', fontWeight: '800' }}>{fmt(report?.totalSales || 0)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '24px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Purchases & Expenses</span>
          <span style={{ fontSize: '24px', fontWeight: '800', color: '#FCA5A5' }}>
            -{fmt((report?.totalPurchases || 0) + (report?.totalExpenses || 0))}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '24px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Profit</span>
          <span style={{ 
            fontSize: '32px', 
            fontWeight: '800', 
            color: isNetProfitPositive ? '#10B981' : '#EF4444' 
          }}>
            {fmt(report?.netProfit || 0)}
          </span>
        </div>
      </div>

      {/* GST Summary Cards (5 columns) */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>GST Summary by Rate</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {gstCards.map((c) => (
          <div key={c.rate} style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
            padding: '16px'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: c.color
            }} />
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Rate {c.rate}</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="split-grid" style={{ marginTop: 28 }}>
        <article className="content-card" style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>GST Summary (GSTR-3B style)</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Output tax (Collected):</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(report?.totalGstCollected || 0)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Input tax credit (Paid):</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(report?.totalGstPaid || 0)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Net payable:</span>
              <span style={{ fontWeight: '800', color: 'var(--accent)' }}>{fmt(report?.gstPayable || 0)}</span>
            </li>
          </ul>
        </article>
        
        <article className="content-card" style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Profit & Loss Overview</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sales revenue:</span>
              <span style={{ fontWeight: '700', color: 'var(--success)' }}>{fmt(report?.totalSales || 0)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Purchases:</span>
              <span style={{ fontWeight: '700', color: 'var(--danger)' }}>-{fmt(report?.totalPurchases || 0)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Operating expenses:</span>
              <span style={{ fontWeight: '700', color: 'var(--danger)' }}>-{fmt(report?.totalExpenses || 0)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Net earnings:</span>
              <span style={{ fontWeight: '800', color: isNetProfitPositive ? 'var(--success)' : 'var(--danger)' }}>{fmt(report?.netProfit || 0)}</span>
            </li>
          </ul>
        </article>
      </div>

      {/* Category Wise Stock Valuation */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '28px', marginBottom: '14px' }}>Inventory Valuation</h3>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '28px'
      }}>
        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Category Wise Stock Valuation</h4>
        {Object.keys(categoryValuation).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No inventory items with cost data available.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {Object.entries(categoryValuation).map(([catName, metrics]) => (
              <div key={catName} style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>{catName}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{metrics.count} Products | {metrics.stock} {metrics.stock === 1 ? 'unit' : 'units'}</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                  {fmt(metrics.valuation)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balance Sheet section */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '28px', marginBottom: '14px' }}>Balance Sheet</h3>
      <div className="split-grid" style={{ marginBottom: 28 }}>
        <article className="content-card" style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Current Assets</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Accounts Receivable:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(balanceSheet.receivables)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Inventory Valuation:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(balanceSheet.inventoryValue)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Cash in Hand:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(balanceSheet.cash)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Bank & Digital Cash:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(balanceSheet.bank)}</span>
            </li>
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', paddingLeft: '12px', borderLeft: '2px solid var(--border)' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>GST Input Tax Credit (ITC):</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>CGST Input:</span>
                <span>{fmt(balanceSheet.cgstInput)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>SGST Input:</span>
                <span>{fmt(balanceSheet.sgstInput)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>IGST Input:</span>
                <span>{fmt(balanceSheet.igstInput)}</span>
              </div>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Total Assets:</span>
              <span style={{ fontWeight: '800', color: 'var(--success)' }}>
                {fmt(balanceSheet.totalAssets)}
              </span>
            </li>
          </ul>
        </article>

        <article className="content-card" style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Current Liabilities & Net Worth</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Accounts Payable:</span>
              <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{fmt(balanceSheet.payables)}</span>
            </li>
            <li style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', paddingLeft: '12px', borderLeft: '2px solid var(--border)' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>GST Tax Liability:</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>CGST Output:</span>
                <span>{fmt(balanceSheet.cgstOutput)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>SGST Output:</span>
                <span>{fmt(balanceSheet.sgstOutput)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>IGST Output:</span>
                <span>{fmt(balanceSheet.igstOutput)}</span>
              </div>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Liabilities:</span>
              <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{fmt(balanceSheet.totalLiabilities)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Opening Balance Equity:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(balanceSheet.openingBalanceEquity)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Retained Earnings:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(balanceSheet.retainedEarnings)}</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Equity / Net Worth:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                {fmt(balanceSheet.equity)}
              </span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1.5px solid var(--border)' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Total Liabilities & Equity:</span>
              <span style={{ fontWeight: '800', color: 'var(--accent)' }}>
                {fmt(balanceSheet.totalLiabilitiesAndEquity)}
              </span>
            </li>
          </ul>
        </article>
      </div>

      {/* Cash Flow Statement section */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '28px', marginBottom: '14px' }}>Cash Flow Statement</h3>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Cash Flow from Operating Activities</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cash Received from Customers:</span>
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>{fmt(cashFlow.customerReceipts)}</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cash Paid to Suppliers:</span>
                <span style={{ fontWeight: '700', color: 'var(--danger)' }}>-{fmt(cashFlow.supplierPayments)}</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cash Paid for Operating Expenses:</span>
                <span style={{ fontWeight: '700', color: 'var(--danger)' }}>-{fmt(cashFlow.operatingExpenses)}</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontWeight: 'bold' }}>
                <span style={{ color: 'var(--text-primary)' }}>Net Cash from Operating Activities:</span>
                <span style={{ color: cashFlow.netOperatingCash >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(cashFlow.netOperatingCash)}</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Other Cash Flows</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Other Cash Inflows (e.g. Equity/Adjustments):</span>
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>{fmt(cashFlow.otherInflows)}</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Other Cash Outflows:</span>
                <span style={{ fontWeight: '700', color: 'var(--danger)' }}>-{fmt(cashFlow.otherOutflows)}</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontWeight: 'bold' }}>
                <span style={{ color: 'var(--text-primary)' }}>Net Cash from Other Activities:</span>
                <span style={{ color: cashFlow.netOtherCash >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(cashFlow.netOtherCash)}</span>
              </li>
            </ul>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', marginTop: '20px', paddingTop: '16px', borderTop: '1.5px solid var(--border)' }}>
          <span style={{ color: 'var(--text-primary)' }}>Net Increase / Decrease in Cash:</span>
          <span style={{ color: cashFlow.netIncrease >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(cashFlow.netIncrease)}</span>
        </div>
      </div>
    </PageSection>
  );
}

export default Reports;
