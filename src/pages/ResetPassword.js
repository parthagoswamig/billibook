import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  // Supabase sends access_token in the URL hash after redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateErr) {
      setError(updateErr.message);
    } else {
      setDone(true);
      setTimeout(() => navigate('/'), 3000);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', padding: '48px 36px', maxWidth: '420px',
        width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', textAlign: 'center'
      }}>
        {done ? (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>
              Password Updated!
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
              Your password has been changed successfully.<br />
              Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔐</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
              Set New Password
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px' }}>
              Enter your new password below
            </p>

            {!sessionReady && (
              <div style={{
                background: '#fef9c3', color: '#854d0e', padding: '12px', borderRadius: '10px',
                fontSize: '13px', marginBottom: '16px', fontWeight: '600'
              }}>
                ⏳ Verifying reset link... Please wait.
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px',
                    border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px',
                    border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {error && (
                <div style={{
                  background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                  borderRadius: '10px', fontSize: '13px', fontWeight: '600'
                }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sessionReady}
                style={{
                  background: sessionReady ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#cbd5e1',
                  color: '#fff', border: 'none', borderRadius: '12px', padding: '14px',
                  fontSize: '15px', fontWeight: '800', cursor: sessionReady ? 'pointer' : 'not-allowed',
                  boxShadow: sessionReady ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? '⏳ Updating...' : '🔐 Update Password'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  background: 'none', border: '1px solid #e5e7eb', borderRadius: '10px',
                  padding: '12px', fontSize: '14px', color: '#64748b', cursor: 'pointer', fontWeight: '600'
                }}
              >
                ← Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
