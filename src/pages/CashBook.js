import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import SimpleTable from '../components/SimpleTable';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { getCashBook } from '../lib/db';
import { formatCurrency, formatDate } from '../lib/utils';

function CashBook() {
  const { userId, loading: userLoading } = useUser();
  const { tenantId } = useRole();
  const { currency } = useBusiness();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fmt = (n) => formatCurrency(n, currency);

  useEffect(() => {
    if (!tenantId) return;
    getCashBook(tenantId).then(setData).finally(() => setLoading(false));
  }, [tenantId]);

  return (
    <PageSection eyebrow="Accounting" title="Cash & Bank Book" description="All money in (payments) and out (expenses) — like myBillBook day book.">
      {loading || userLoading ? <div className="empty-state">Loading...</div> : (
        <>
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <article className="stat-card"><p className="stat-label">Money In</p><h3>{fmt(data?.totalIn)}</h3></article>
            <article className="stat-card"><p className="stat-label">Money Out</p><h3>{fmt(data?.totalOut)}</h3></article>
            <article className="stat-card highlight-card"><p className="stat-label">Balance</p><h3>{fmt(data?.balance)}</h3></article>
          </div>
          <SimpleTable
            columns={['Date', 'Type', 'Category', 'Reference', 'Amount', 'Mode']}
            rows={(data?.entries || []).map((e) => [
              formatDate(e.date), e.type === 'in' ? '↓ In' : '↑ Out', e.category, e.ref || '—',
              `${e.type === 'in' ? '+' : '-'}${fmt(e.amount)}`, e.mode,
            ])}
          />
        </>
      )}
    </PageSection>
  );
}

export default CashBook;
