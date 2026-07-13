import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import SimpleTable from '../components/SimpleTable';
import { useUser } from '../lib/useUser';
import { getSuperAdminStats } from '../lib/db';
import { formatCurrency, formatDate } from '../lib/utils';
import { toast } from 'react-hot-toast';

function SuperAdmin() {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'businesses'
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    setLoading(true);
    getSuperAdminStats(user.email)
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        console.error('Super Admin fetch error:', err);
        toast.error('Failed to load Super Admin stats. Ensure you ran the SQL function.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user?.email, refreshTrigger]);

  if (loading) {
    return <div className="loading-screen">Loading Super Admin Panel...</div>;
  }

  const formatSales = (val) => {
    return formatCurrency(parseFloat(val || 0), '₹');
  };

  // Metric calculation
  const metrics = [
    { label: 'Platform Users', value: stats?.total_users || 0, icon: '👥', color: '#3b82f6' },
    { label: 'Total Businesses', value: stats?.total_businesses || 0, icon: '🏢', color: '#10b981' },
    { label: 'Total Invoices', value: stats?.total_invoices || 0, icon: '📄', color: '#f59e0b' },
    { label: 'Total Sales', value: formatSales(stats?.total_sales_amount), icon: '💰', color: '#8b5cf6' },
  ];

  // Filtering
  const filteredUsers = (stats?.recent_users || []).filter((u) => {
    if (!searchQuery) return true;
    return u.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredBusinesses = (stats?.recent_businesses || []).filter((b) => {
    if (!searchQuery) return true;
    return (
      b.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner_email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // SimpleTable formatters
  const usersColumns = ['User Email', 'Businesses', 'Date Joined', 'Last Active'];
  const usersRows = filteredUsers.map((u) => [
    u.email,
    `${u.business_count || 0} business(es)`,
    formatDate(u.created_at),
    u.last_sign_in_at ? formatDate(u.last_sign_in_at) : 'N/A',
  ]);

  const businessColumns = ['Business Name', 'Owner Email', 'Invoices', 'Total Sales', 'Created At'];
  const businessRows = filteredBusinesses.map((b) => [
    b.business_name || 'Unnamed Business',
    b.owner_email || 'N/A',
    `${b.invoice_count || 0} invoices`,
    formatSales(b.total_sales),
    formatDate(b.created_at),
  ]);

  return (
    <PageSection
      eyebrow="System Administration"
      title="Super Admin Dashboard"
      description="All business metrics and customer registrations across the KhataPe platform."
      actions={
        <button
          onClick={() => {
            setRefreshTrigger((p) => p + 1);
            toast.success('Refreshing stats...');
          }}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)',
          }}
        >
          🔄 Refresh Data
        </button>
      }
    >
      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {metrics.map((m, idx) => (
          <div
            key={idx}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>
                {m.label}
              </p>
              <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{m.value}</h3>
            </div>
            <span style={{ fontSize: '28px', opacity: 0.8, color: m.color }}>{m.icon}</span>
          </div>
        ))}
      </div>

      {/* Tabs and Search Section */}
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
          }}
        >
          {/* Tab Selector Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setActiveTab('users');
                setSearchQuery('');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '14px',
                background: activeTab === 'users' ? '#f1f5f9' : 'transparent',
                color: activeTab === 'users' ? '#0f172a' : '#64748b',
                transition: 'all 0.2s',
              }}
            >
              👥 Registered Users ({stats?.recent_users?.length || 0})
            </button>
            <button
              onClick={() => {
                setActiveTab('businesses');
                setSearchQuery('');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '14px',
                background: activeTab === 'businesses' ? '#f1f5f9' : 'transparent',
                color: activeTab === 'businesses' ? '#0f172a' : '#64748b',
                transition: 'all 0.2s',
              }}
            >
              🏢 Created Businesses ({stats?.recent_businesses?.length || 0})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder={activeTab === 'users' ? 'Search by email...' : 'Search by name or email...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
              }}
            />
          </div>
        </div>

        {/* Content Table */}
        {activeTab === 'users' ? (
          filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <span style={{ fontSize: '32px' }}>🔍</span>
              <p style={{ marginTop: '8px', fontWeight: '500' }}>No users found matching your search.</p>
            </div>
          ) : (
            <SimpleTable columns={usersColumns} rows={usersRows} />
          )
        ) : filteredBusinesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <span style={{ fontSize: '32px' }}>🔍</span>
            <p style={{ marginTop: '8px', fontWeight: '500' }}>No businesses found matching your search.</p>
          </div>
        ) : (
          <SimpleTable columns={businessColumns} rows={businessRows} />
        )}
      </div>
    </PageSection>
  );
}

export default SuperAdmin;
