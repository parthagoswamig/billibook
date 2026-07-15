import React, { useState, useEffect } from 'react';
import { supabase, supabaseConfigError } from '../db';
import { ensureUserRole, applyTeamInvite, saveProfile } from '../lib/db';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import './Auth.css';

function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const modeParam = params.get('mode');
    if (emailParam) {
      setEmail(emailParam);
    }
    if (modeParam && ['login', 'signup'].includes(modeParam)) {
      setMode(modeParam);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !businessName.trim()) {
      setError('Please enter your business name');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !phone.trim()) {
      setError('Please enter your mobile number');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) setError(loginError.message);
        else if (data.user) {
          // If first login after signup, they need the admin role
          await ensureUserRole(data.user.id, 'admin');
          await applyTeamInvite(data.user.id, email);
          
          // Ensure business profile exists (using metadata from signup)
          const meta = data.user.user_metadata || {};
          const bName = meta.business_name || '';
          const bPhone = meta.phone || '';
          
          const { data: existingProfile } = await supabase
            .from('business_profile')
            .select('id, phone')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (!existingProfile) {
            await supabase.from('business_profile').insert([{
              user_id: data.user.id,
              business_name: bName || null,
              email: data.user.email,
              phone: bPhone || null,
            }]);
          } else if (!existingProfile.phone && bPhone) {
            await supabase.from('business_profile').update({ phone: bPhone }).eq('id', existingProfile.id);
          }

          toast.success('Login Successful!', { 
            duration: 3000, 
            position: 'top-center',
            style: { fontWeight: '600', borderRadius: '10px' }
          });
        }
      } else {
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { business_name: businessName.trim(), phone: phone.trim() } },
        });
        if (signupError) setError(signupError.message);
        else {
          // Profile & Role creation moved to login due to email confirmation / RLS
          setShowVerifyModal(true);
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-branding">
            <div className="brand-logo" style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src="/logo.png" alt="KhataPe Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
            </div>
            <h1 className="brand-title">KhataPe</h1>
            <p className="brand-tagline">GST Billing Software</p>
          </div>
          <div className="auth-header">
            <h2>{mode === 'login' ? 'Welcome Back' : 'Get Started'}</h2>
            <p>{mode === 'login' ? 'Sign in to your account' : 'Create your free account'}</p>
          </div>
          {supabaseConfigError && (
            <div className="form-message form-error">{supabaseConfigError}</div>
          )}
          <div className="auth-toggle">
            <button className={`toggle-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }} type="button">Login</button>
            <button className={`toggle-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); }} type="button">Sign Up</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <label className="form-label"><span>Business Name</span>
                  <input type="text" placeholder="Your business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="form-input" />
                </label>
                <label className="form-label"><span>Mobile Number</span>
                  <input type="tel" placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" />
                </label>
              </>
            )}
            <label className="form-label"><span>Email</span>
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />
            </label>
            <label className="form-label"><span>Password</span>
              <input type="password" placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'signup' ? 6 : undefined} className="form-input" required />
            </label>
            {error && <div className="form-message form-error"><span className="message-icon">⚠️</span>{error}</div>}
            {message && <div className="form-message form-success"><span className="message-icon">✓</span>{message}</div>}
            <button className="submit-button" disabled={loading} type="submit">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setForgotMode(true); setForgotEmail(email); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', cursor: 'pointer', marginTop: '8px', textDecoration: 'underline', fontWeight: '600' }}
              >
                Forgot Password?
              </button>
            )}
          </form>
        </div>
        <div className="auth-apk-download">
          <a href="/KhataPe.apk" download="KhataPe.apk" className="apk-download-banner">
            <span className="apk-icon">📱</span>
            <div className="apk-text">
              <strong>Download Android App</strong>
              <span>Manage your business on the go</span>
            </div>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#6b7280' }}>
          <Link to="/privacy-policy" style={{ color: '#6b7280', textDecoration: 'none', margin: '0 8px' }}>Privacy Policy</Link> | 
          <Link to="/terms-and-conditions" style={{ color: '#6b7280', textDecoration: 'none', margin: '0 8px' }}>Terms & Conditions</Link> <br/>
          <Link to="/about-us" style={{ color: '#6b7280', textDecoration: 'none', margin: '0 8px' }}>About Us</Link> | 
          <Link to="/contact-us" style={{ color: '#6b7280', textDecoration: 'none', margin: '0 8px' }}>Contact Us</Link>
        </div>
      </div>

      <style>{`
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
              <strong>{email}</strong>.<br/><br/>
              Please check your inbox and click the link to activate your account.
            </p>
            <button 
              onClick={() => {
                setShowVerifyModal(false);
                setMode('login');
                setEmail('');
                setPassword('');
                setBusinessName('');
                setPhone('');
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

      {/* Forgot Password Modal */}
      {forgotMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: '40px 30px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            {forgotSent ? (
              <>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1E3A5F', marginBottom: 10 }}>Check Your Email</h2>
                <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, marginBottom: 24 }}>
                  We sent a password reset link to<br/><strong>{forgotEmail}</strong>.<br/><br/>
                  Click the link in the email to set a new password.
                </p>
                <button onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(''); }} style={{ width: '100%', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Go to Login</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🔐</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1E3A5F', marginBottom: 8 }}>Reset Password</h2>
                <p style={{ fontSize: 14, color: '#4B5563', marginBottom: 20 }}>Enter your email and we'll send you a reset link.</p>
                {error && <div className="form-message form-error" style={{ marginBottom: 12 }}>{error}</div>}
                <form onSubmit={handleForgotPassword} style={{ display: 'grid', gap: '12px' }}>
                  <input
                    type="email" required placeholder="your@email.com"
                    value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button type="submit" disabled={forgotLoading} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => { setForgotMode(false); setError(''); }} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px', fontSize: 14, color: '#6b7280', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default Auth;
