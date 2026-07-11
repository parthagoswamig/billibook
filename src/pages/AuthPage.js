// src/pages/AuthPage.js
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getVisitStats } from '../lib/visitTracker';
import { toast } from 'react-hot-toast';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', businessName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [visitStats, setVisitStats] = useState(null);

  // Fetch login stats on mount (tracking is done in App.js on SIGNED_IN event)
  useEffect(() => {
    getVisitStats().then(setVisitStats);
  }, []);

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
        else toast.success('Login Successful!', { 
          duration: 3000, 
          position: 'top-center',
          style: { fontWeight: '600', borderRadius: '10px' }
        });
      } else {
        const { error } = await signUp(form.email, form.password, form.businessName);
        if (error) setError(error.message);
        else {
          setShowVerifyModal(true);
        }
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif", gap: 20, padding: 16 }}>

      {/* Live Visitor Counter — PUBLIC, visible to everyone */}
      {visitStats !== null && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
          animation: 'fadeIn 0.6s ease',
        }}>
          {/* Today's Views */}
          <div style={{
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14,
            padding: '12px 22px', textAlign: 'center', minWidth: 130,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
              {visitStats.todayTotal.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontWeight: 600, letterSpacing: 0.3 }}>
              📊 TODAY'S LOGINS
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>🌐 Web: {visitStats.todayWeb}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>📱 App: {visitStats.todayApp}</span>
            </div>
          </div>

          {/* Total Views */}
          <div style={{
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14,
            padding: '12px 22px', textAlign: 'center', minWidth: 130,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#FBBF24', lineHeight: 1.1 }}>
              {visitStats.total.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontWeight: 600, letterSpacing: 0.3 }}>
              🔥 TOTAL LOGINS
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>🌐 Web: {visitStats.totalWeb}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>📱 App: {visitStats.totalApp}</span>
            </div>
          </div>

          {/* Live pulse indicator */}
          <div style={{
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14,
            padding: '12px 22px', textAlign: 'center', minWidth: 130,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: '#4ADE80', boxShadow: '0 0 0 3px rgba(74,222,128,0.3)',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4ADE80' }}>LIVE</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 5 }}>
              Web + App Logins
            </div>
          </div>
        </div>
      )}

      {/* Login Card */}
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 40, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

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

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(74,222,128,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(74,222,128,0.1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Email Verification Modal Popup */}
      {showVerifyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '40px 30px', maxWidth: 400, width: '100%',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📧</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1E3A5F', marginBottom: 12 }}>
              Check Your Email
            </h2>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.5, marginBottom: 24 }}>
              We've sent a verification link to<br/>
              <strong>{form.email}</strong>.<br/><br/>
              Please check your inbox and click the link to activate your account.
            </p>
            <button 
              onClick={() => {
                setShowVerifyModal(false);
                setMode('login');
                setForm({ email: '', password: '', businessName: '' });
              }}
              style={{
                width: '100%', background: '#1E3A5F', color: '#fff', border: 'none', 
                borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 700, 
                cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(30,58,95,0.2)'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#254a7c'}
              onMouseOut={e => e.currentTarget.style.background = '#1E3A5F'}
            >
              Okay, I understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
