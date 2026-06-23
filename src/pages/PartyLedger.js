import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { getPartyLedger } from '../lib/db';
import { formatCurrency, formatDate } from '../lib/utils';

function PartyLedger() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useRole();
  const { currency, profile } = useBusiness();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const fmt = (n) => formatCurrency(n, currency);

  useEffect(() => {
    if (!tenantId || !partyId) return;
    getPartyLedger(tenantId, partyId).then(setLedger).finally(() => setLoading(false));
  }, [tenantId, partyId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="loading-screen">Loading ledger...</div>;
  if (!ledger?.party) return <div className="loading-screen">Party not found</div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide non-printable UI components */
          .sidebar, 
          .sidebar-footer-wrapper,
          .app-shell .sidebar, 
          .app-content > header,
          .page-section-header,
          .back-btn-container,
          .no-print,
          button,
          .secondary-button {
            display: none !important;
          }
          
          /* Full width layout for print */
          .app-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          
          body {
            background: white !important;
            color: black !important;
            font-size: 12px !important;
          }

          .print-header {
            display: block !important;
            margin-bottom: 24px !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 12px !important;
          }

          .print-header-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 20px !important;
          }

          .stats-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            margin-bottom: 20px !important;
          }

          .stat-card {
            border: 1px solid #cbd5e1 !important;
            padding: 12px !important;
            background: #f8fafc !important;
            text-align: center !important;
          }

          .simple-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 16px !important;
          }

          .simple-table th, .simple-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 8px !important;
            font-size: 11px !important;
            text-align: left !important;
          }

          .simple-table th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
          }
        }

        /* Default hidden header for screen view */
        .print-header {
          display: none;
        }
      `}} />

      <div className="back-btn-container no-print" style={{ padding: '16px 24px 0 24px' }}>
        <button className="secondary-button" type="button" onClick={() => navigate('/customers')}>
          ← Back to Parties
        </button>
      </div>

      {/* Print Statement Header */}
      <div className="print-header">
        <div className="print-header-grid">
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>{profile?.business_name || 'Business Account Statement'}</h2>
            {profile?.address && <p>{profile.address}</p>}
            {profile?.phone && <p>Phone: {profile.phone}</p>}
            {profile?.email && <p>Email: {profile.email}</p>}
            {profile?.gstin && <p><strong>GSTIN: {profile.gstin}</strong></p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent)' }}>LEDGER STATEMENT</h3>
            <p style={{ marginTop: '8px' }}>Statement Date: {new Date().toLocaleDateString()}</p>
            <p style={{ marginTop: '8px' }}><strong>Party Details:</strong></p>
            <p>{ledger.party.name}</p>
            {ledger.party.phone && <p>Phone: {ledger.party.phone}</p>}
            {ledger.party.gstin && <p>GSTIN: {ledger.party.gstin}</p>}
          </div>
        </div>
      </div>

      <PageSection
        eyebrow="Accounting"
        title={`Party Ledger — ${ledger.party.name}`}
        description={`Chronological transactions history statement for this ${ledger.party.type}.`}
        actions={
          <button className="primary-button no-print" type="button" onClick={handlePrint}>
            🖨️ Print Statement
          </button>
        }
      >
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <article className="stat-card">
            <p className="stat-label">Total Transactions</p>
            <h3>{ledger.entries.length}</h3>
          </article>
          <article className="stat-card">
            <p className="stat-label">Party Type</p>
            <h3 style={{ textTransform: 'capitalize' }}>{ledger.party.type}</h3>
          </article>
          <article className="stat-card highlight-card">
            <p className="stat-label">Net Outstanding</p>
            <h3>{fmt(ledger.outstanding)}</h3>
          </article>
        </div>

        <div className="simple-table-wrapper">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref/Doc</th>
                <th>Particulars</th>
                <th>Debit (Dr)</th>
                <th>Credit (Cr)</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No transactions recorded for this party.</td>
                </tr>
              ) : (
                ledger.entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(entry.date)}</td>
                    <td><strong>{entry.ref}</strong></td>
                    <td>{entry.particulars}</td>
                    <td style={{ color: entry.debit > 0 ? 'var(--danger)' : 'inherit', fontWeight: entry.debit > 0 ? '600' : 'normal' }}>
                      {entry.debit > 0 ? fmt(entry.debit) : '—'}
                    </td>
                    <td style={{ color: entry.credit > 0 ? 'var(--success)' : 'inherit', fontWeight: entry.credit > 0 ? '600' : 'normal' }}>
                      {entry.credit > 0 ? fmt(entry.credit) : '—'}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {fmt(entry.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </>
  );
}

export default PartyLedger;

