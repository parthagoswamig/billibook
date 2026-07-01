import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { getDashboardStats } from '../lib/db';
import { formatCurrency, formatDate, buildWhatsAppUrl } from '../lib/utils';
import { useRole } from '../lib/RoleContext';
import { getVisitStats } from '../lib/visitTracker';
import './Dashboard.css';
function Dashboard() {
  const { userId, loading: userLoading } = useUser();
  const { currency } = useBusiness();
  const navigate = useNavigate();
  const { canCreate, tenantId } = useRole();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [visitStats, setVisitStats] = useState(null);
  const fmt = (n) => formatCurrency(n, currency);

  useEffect(() => {
    getVisitStats().then(setVisitStats);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    getDashboardStats(tenantId, timeRange).then(setStats).finally(() => setLoading(false));
  }, [tenantId, timeRange]);

  if (loading || userLoading) return <div className="loading-screen">Loading dashboard...</div>;

  const rangeLabel = timeRange === 'today' ? 'today'
                   : timeRange === 'week' ? 'week' 
                   : timeRange === 'month' ? 'month' 
                   : timeRange === 'quarter' ? 'quarter' 
                   : 'year';

  const metrics = [
    { 
      icon: '📊', 
      label: timeRange === 'today' ? 'Sales (Today)' : `Sales (this ${rangeLabel})`, 
      value: fmt(stats?.totalSales || 0), 
      note: `${stats?.monthInvoiceCount || 0} invoices`, 
      trend: stats?.salesGrowth ? (stats.salesGrowth >= 0 ? `+${stats.salesGrowth}%` : `${stats.salesGrowth}%`) : null 
    },
    { 
      icon: '💰', 
      label: timeRange === 'today' ? 'Received (Today)' : `Received (this ${rangeLabel})`, 
      value: fmt(stats?.totalReceived || 0), 
      note: 'Payments collected' 
    },
    { 
      icon: '⏳', 
      label: 'Pending', 
      value: fmt(stats?.totalPending || 0), 
      note: `${stats?.overdueInvoices?.length || 0} overdue` 
    },
    { 
      icon: '📉', 
      label: timeRange === 'today' ? 'Expenses (Today)' : `Expenses (this ${rangeLabel})`, 
      value: fmt(stats?.totalExpenses || 0), 
      note: `Profit: ${fmt(stats?.netProfit || 0)}` 
    },
  ];

  // Simple chart data visualization
  const salesData = stats?.chartData || [];
  const maxSales = Math.max(1, ...salesData.map(d => Math.max(d.sales, d.expenses)));

  return (
    <PageSection eyebrow="Overview" title="Dashboard" description="Live business snapshot with advanced analytics.">
      {/* Time Range Selector */}
      <div className="time-range-selector">
        <button 
          className={`range-btn ${timeRange === 'today' ? 'active' : ''}`}
          onClick={() => setTimeRange('today')}
        >
          Today
        </button>
        <button 
          className={`range-btn ${timeRange === 'week' ? 'active' : ''}`}
          onClick={() => setTimeRange('week')}
        >
          This Week
        </button>
        <button 
          className={`range-btn ${timeRange === 'month' ? 'active' : ''}`}
          onClick={() => setTimeRange('month')}
        >
          This Month
        </button>
        <button 
          className={`range-btn ${timeRange === 'quarter' ? 'active' : ''}`}
          onClick={() => setTimeRange('quarter')}
        >
          This Quarter
        </button>
        <button 
          className={`range-btn ${timeRange === 'year' ? 'active' : ''}`}
          onClick={() => setTimeRange('year')}
        >
          This Year
        </button>
      </div>

      {/* Dynamic Health Insight Banner */}
      {stats?.insight && (
        <div style={{
          background: 'linear-gradient(90deg, #EEF2FF 0%, #FAF5FF 100%)',
          border: '1px solid #E0E7FF',
          padding: '14px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(99,102,241,0.04)'
        }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <span style={{ fontSize: '13.5px', fontWeight: '500', color: '#3730A3', lineHeight: '1.4' }}>
            <strong>Billing Insight:</strong> {stats.insight}
          </span>
        </div>
      )}

      {/* Enhanced Stats Grid */}
      <div className="stats-grid enhanced">
        {metrics.map((m) => (
          <article className="stat-card enhanced" key={m.label}>
            <div className="stat-header">
              <p className="stat-label">{m.label}</p>
              <span className="stat-icon">{m.icon}</span>
            </div>
            <h3 className="stat-value">{m.value}</h3>
            <div className="stat-footer">
              <p className="stat-note">{m.note}</p>
              {m.trend && (
                <span className={`stat-trend ${m.trend?.startsWith('+') ? 'positive' : 'negative'}`}>
                  {m.trend}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>


      {/* Sales Chart */}
      <div className="chart-section">
        <div className="content-card chart-card">
          <div className="chart-header">
            <h3>📈 Sales vs Expenses</h3>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color sales"></span>
                Sales
              </span>
              <span className="legend-item">
                <span className="legend-color expenses"></span>
                Expenses
              </span>
            </div>
          </div>
          <div className="chart-container">
            <div className="bar-chart">
              {salesData.map((data, index) => (
                <div key={index} className="chart-bar-group">
                  <div className="bar-wrapper">
                    <div 
                      className="bar sales-bar"
                      style={{ height: `${(data.sales / maxSales) * 100}%` }}
                      title={`Sales: ${fmt(data.sales)}`}
                    >
                      <span className="bar-label">{fmt(data.sales)}</span>
                    </div>
                    <div 
                      className="bar expenses-bar"
                      style={{ height: `${(data.expenses / maxSales) * 100}%` }}
                      title={`Expenses: ${fmt(data.expenses)}`}
                    >
                      <span className="bar-label">{fmt(data.expenses)}</span>
                    </div>
                  </div>
                  <span className="bar-month">{data.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Analytics Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Payment Modes */}
        <article className="content-card enhanced" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>💳 Payment Channel Distribution</h3>
          {(!stats?.paymentModes || stats.paymentModes.length === 0) ? (
            <div className="empty-state" style={{ minHeight: '120px' }}>
              <p className="muted-text">No payment records this period.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {stats.paymentModes.map((pm, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                    <span>{pm.mode}</span>
                    <span>{fmt(pm.amount)} ({pm.percentage}%)</span>
                  </div>
                  <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      background: idx === 0 ? 'var(--accent)' : idx === 1 ? 'var(--success)' : '#94A3B8',
                      width: `${pm.percentage}%`,
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* Top Performing Customers / Products */}
        <article className="content-card enhanced" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>⭐ Top Performing Accounts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Clients</h4>
              {(!stats?.topCustomers || stats.topCustomers.length === 0) ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data</span>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.topCustomers.map((tc, idx) => (
                    <li key={idx} style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tc.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{fmt(tc.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Products</h4>
              {(!stats?.topProducts || stats.topProducts.length === 0) ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data</span>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.topProducts.map((tp, idx) => (
                    <li key={idx} style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tp.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{tp.qty} qty sold</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>
      </div>

      {/* Enhanced Split Grid */}
      <div className="split-grid enhanced">
        <article className="content-card enhanced">
          <div className="card-header">
            <h3>⚠ Overdue Invoices</h3>
            <span className="badge alert">{stats?.overdueInvoices?.length || 0}</span>
          </div>
          {(stats?.overdueInvoices?.length || 0) === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✅</span>
              <p className="muted-text">All payments on track!</p>
            </div>
          ) : (
            <ul className="priority-list enhanced">
              {stats.overdueInvoices.map((inv) => (
                <li key={inv.id} className="priority-item">
                  <div className="priority-content">
                    <div className="priority-main">
                      <span className="priority-title">{inv.invoice_no}</span>
                      <span className="priority-customer">{inv.customers?.name}</span>
                    </div>
                    <div className="priority-meta">
                      <span className="priority-amount">{fmt(inv.balance)}</span>
                      <span className="priority-date">Due: {formatDate(inv.due_date)}</span>
                    </div>
                  </div>
                  <div className="row-actions">
                    <button className="action-button primary" type="button" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      View
                    </button>
                    {inv.customers?.phone && (
                      <a 
                        className="action-button whatsapp" 
                        href={buildWhatsAppUrl(inv.customers.phone, `Payment Reminder: Invoice ${inv.invoice_no} balance ${fmt(inv.balance)} was due on ${formatDate(inv.due_date)}. Please pay at your earliest convenience.`)} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="content-card enhanced">
          <div className="card-header">
            <h3>📋 Recent Invoices</h3>
            <Link to="/invoices" className="view-all">View All</Link>
          </div>
          {(stats?.recentInvoices?.length || 0) === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📄</span>
              <p className="muted-text">No invoices yet.</p>
              <Link to="/invoices" state={{ openCreate: true }} className="create-link">Create First Invoice</Link>
            </div>
          ) : (
            <ul className="simple-list enhanced">
              {stats.recentInvoices.map((inv) => (
                <li key={inv.id} className="list-item">
                  <Link to={`/invoices/${inv.id}`} className="item-link">
                    <div className="item-main">
                      <span className="item-title">{inv.invoice_no}</span>
                      <span className="item-customer">{inv.customers?.name}</span>
                    </div>
                    <div className="item-meta">
                      <span className="item-amount">{fmt(inv.total)}</span>
                      <span className={`item-status status-${inv.status}`}>{inv.status}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {stats?.lowStock?.length > 0 && (
            <div className="alert-box warning">
              <span className="alert-icon">📦</span>
              <span className="alert-text">{stats.lowStock.length} product(s) low on stock</span>
              <Link to="/products" className="alert-action">View Products</Link>
            </div>
          )}
        </article>
      </div>

      {/* Quick Actions */}
      {canCreate() && (
        <div className="quick-actions">
          <h3>⚡ Quick Actions</h3>
          <div className="actions-grid">
            <Link to="/invoices" state={{ openCreate: true }} className="quick-action-card">
              <span className="action-icon">📄</span>
              <span className="action-label">New Invoice</span>
            </Link>
            <Link to="/customers" className="quick-action-card">
              <span className="action-icon">👥</span>
              <span className="action-label">Add Customer</span>
            </Link>
            <Link to="/products" className="quick-action-card">
              <span className="action-icon">📦</span>
              <span className="action-label">Add Product</span>
            </Link>
            <Link to="/expenses" className="quick-action-card">
              <span className="action-icon">💰</span>
              <span className="action-label">Record Expense</span>
            </Link>
          </div>
        </div>
      )}

      {/* Live App View Stats — bottom of dashboard */}
      {visitStats && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 0 3px rgba(74,222,128,0.25)', animation: 'pulse-dot 1.5s infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', letterSpacing: 0.3 }}>LIVE APP STATS</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '1px solid #BFDBFE', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1D4ED8' }}>{visitStats.todayWeb.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600, marginTop: 4 }}>🌐 Website Today</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '1px solid #BBF7D0', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#15803D' }}>{visitStats.todayApp.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600, marginTop: 4 }}>📱 Mobile App Today</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', border: '1px solid #DDD6FE', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#6D28D9' }}>{visitStats.totalWeb.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, marginTop: 4 }}>🌐 Website Total</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', border: '1px solid #FED7AA', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#C2410C' }}>{visitStats.totalApp.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#EA580C', fontWeight: 600, marginTop: 4 }}>📱 Mobile App Total</div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 3px rgba(74,222,128,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(74,222,128,0.1); }
        }
      `}</style>
    </PageSection>
  );
}

export default Dashboard;
