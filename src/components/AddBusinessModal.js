import React, { useState } from 'react';
import { supabase } from '../db';

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)'
};

const modalStyle = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  width: '450px',
  maxWidth: '90%',
  padding: '24px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
  color: '#f8fafc',
  border: '1px solid rgba(255,255,255,0.1)'
};

export default function AddBusinessModal({ isOpen, onClose, currentEmail }) {
  const [step, setStep] = useState(1);
  const [aliasEmail, setAliasEmail] = useState('');

  if (!isOpen) return null;

  const suggestAlias = () => {
    if (!currentEmail) return '';
    const parts = currentEmail.split('@');
    if (parts.length !== 2) return currentEmail;
    // Remove existing alias if any
    const baseName = parts[0].split('+')[0];
    return `${baseName}+business${Math.floor(Math.random() * 100)}@${parts[1]}`;
  };

  const handleNext = () => {
    if (step === 1) {
      setAliasEmail(suggestAlias());
      setStep(2);
    } else {
      onClose();
      // Optional: auto logout to force sign up
      supabase.auth.signOut();
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏢</span> Add New Business
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        {step === 1 && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              To ensure 100% data security and isolation, each business in KhataPe is tied to a separate account. 
            </p>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              <h4 style={{ color: '#60A5FA', margin: '0 0 8px 0', fontSize: '14px' }}>How it works:</h4>
              <ol style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.9)', fontSize: '13px', lineHeight: '1.5' }}>
                <li>We will log you out.</li>
                <li>Sign up with a new email (or a Gmail alias like <strong>you+biz2@gmail.com</strong>).</li>
                <li>Create the new business.</li>
                <li>Go to Settings  Team and <strong>Invite</strong> your main email ({currentEmail}).</li>
                <li>Log back in as {currentEmail} and accept the invite!</li>
              </ol>
            </div>
            <button 
              onClick={handleNext}
              style={{ width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              Continue to Step 2 ➡️
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              If you use Gmail, you can use a <strong>"+" alias</strong> so you don't need to create a brand new email account. All emails will still go to your main inbox!
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Suggested Alias Email to Sign Up With:</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}>
                <input 
                  type="text" 
                  value={aliasEmail} 
                  onChange={(e) => setAliasEmail(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#10B981', fontSize: '14px', fontWeight: 'bold', width: '100%', outline: 'none' }}
                />
              </div>
              <p style={{ fontSize: '11px', color: '#F59E0B', marginTop: '8px' }}>
                ⚠️ Copy this email. You will use this to sign up now.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setStep(1)}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Back
              </button>
              <button 
                onClick={handleNext}
                style={{ flex: 2, padding: '12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Sign Out & Create New ✨
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
