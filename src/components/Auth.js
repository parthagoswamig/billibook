import React, { useState } from 'react';
import { supabase, supabaseConfigError } from '../db';
import { ensureUserRole, applyTeamInvite, saveProfile } from '../lib/db';
import './Auth.css';

function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

    if (mode === 'signup' && !businessName) {
      setError('Please enter your business name');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) setError(loginError.message);
        else if (data.user) {
          await ensureUserRole(data.user.id);
          await applyTeamInvite(data.user.id, email);
        }
      } else {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { business_name: businessName.trim() } },
        });
        if (signupError) setError(signupError.message);
        else {
          if (data.user) {
            await ensureUserRole(data.user.id, 'admin');
            await saveProfile(data.user.id, { business_name: businessName.trim(), email });
          }
          setMessage('✓ Account created! Check your email to confirm, then log in.');
          setEmail('');
          setPassword('');
          setBusinessName('');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-branding">
            <div className="brand-logo"><span className="logo-icon">📒</span></div>
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
              <label className="form-label"><span>Business Name</span>
                <input type="text" placeholder="Your business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="form-input" />
              </label>
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
          </form>
        </div>
      </div>
    </div>
  );
}

export default Auth;
