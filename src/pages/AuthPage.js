// src/pages/AuthPage.js
import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', businessName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!form.email || !form.password) return setError('Email & password required');
    if (mode === 'signup' && !form.businessName.trim()) return setError('Business name required');
    if (mode === 'signup' && form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password);
        if (error) setError(error.message);
      } else {
        const { error } = await signUp(form.email, form.password, form.businessName);
        if (error) setError(error.message);
        else setSuccess('Account created! Please check your email to confirm, then login.');
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const inp = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8,
    fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA',
    transition: 'border 0.15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: 420, background: '#fff', borderRadius: 20, padding: 40, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: '#1E3A5F', borderRadius: 14, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>📒</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1E3A5F', letterSpacing: -0.5 }}>KhataPe</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>GST Billing & Accounting Software</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1E3A5F' : '#9CA3AF', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {m === 'login' ? '🔑 Login' : '✨ Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Business Name</label>
              <input value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="e.g. Sharma Traders" style={inp} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email Address</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" style={inp} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter password'} style={inp} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: '1px solid #FECACA' }}>⚠️ {error}</div>
          )}
          {success && (
            <div style={{ background: '#F0FDF4', color: '#16A34A', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: '1px solid #BBF7D0' }}>✅ {success}</div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{ background: loading ? '#93C5FD' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, transition: 'background 0.15s' }}>
            {loading ? '⏳ Please wait...' : mode === 'login' ? '🔑 Login to Dashboard' : '🚀 Create Free Account'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#9CA3AF' }}>
          🔒 Your data is secure & private • Each business has separate data
        </div>
      </div>
    </div>
  );
}
