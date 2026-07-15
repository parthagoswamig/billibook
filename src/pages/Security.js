import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import { getAuditLogs } from '../lib/db';
import './Security.css';

function Security() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const auditData = await getAuditLogs();
        setLogs(auditData);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const failedAttempts = logs.filter(l => l.action === 'failed_access');
  const userEvents = logs.filter(l => 
    ['user_create', 'role_create', 'role_change', 'role_delete', 'role_update'].includes(l.action) ||
    (l.entity_type === 'team_invites')
  );

  return (
    <PageSection
      eyebrow="Admin"
      title="Security & Audit Logs"
      description="Monitor user activities, privilege alterations, and access violations."
    >
      {loading ? (
        <div className="security-loading">Loading security audit records...</div>
      ) : (
        <div className="security-dashboard">
          {/* Summary Cards */}
          <div className="security-cards-grid">
            <div className="security-card">
              <div className="security-card-icon">📊</div>
              <div className="security-card-content">
                <h4>Total Events</h4>
                <p className="card-value">{logs.length}</p>
              </div>
            </div>
            <div className={`security-card ${failedAttempts.length > 0 ? 'card-alert' : ''}`}>
              <div className="security-card-icon">🚨</div>
              <div className="security-card-content">
                <h4>Failed Access Attempts</h4>
                <p className="card-value">{failedAttempts.length}</p>
              </div>
            </div>
            <div className="security-card">
              <div className="security-card-icon">👤</div>
              <div className="security-card-content">
                <h4>User Modifications</h4>
                <p className="card-value">{userEvents.length}</p>
              </div>
            </div>
          </div>

          <div className="security-main-content">
            {/* Timeline */}
            <div className="security-timeline-panel">
              <h3>Timeline & User Access Events</h3>
              <div className="timeline-items">
                {userEvents.length === 0 ? (
                  <p className="muted-text">No user configuration changes recorded.</p>
                ) : (
                  userEvents.slice(0, 5).map((evt) => (
                    <div key={evt.id} className="timeline-item">
                      <div className="timeline-marker"></div>
                      <div className="timeline-details">
                        <span className="timeline-time">{new Date(evt.created_at).toLocaleString('en-IN')}</span>
                        <p className="timeline-desc">
                          <strong>{evt.action.toUpperCase()}</strong>: {evt.details?.email || evt.details?.new_role || 'User/Role Modified'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Failed Access Attempts Detailed */}
            {failedAttempts.length > 0 && (
              <div className="security-alerts-panel">
                <h3>Failed Access Alerts</h3>
                <div className="failed-attempts-list">
                  {failedAttempts.slice(0, 5).map(fail => (
                    <div key={fail.id} className="failed-attempt-item">
                      <div className="fail-header">
                        <span className="fail-title">Unauthorized Write Attempt</span>
                        <span className="fail-time">{new Date(fail.created_at).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="fail-body">
                        User tried to perform <strong>{fail.details?.action || 'mutation'}</strong> on <strong>{fail.entity_type}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageSection>
  );
}

export default Security;
