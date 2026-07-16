import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { saveProfile } from '../lib/db';
import { useUser } from '../lib/useUser';
import { useRole } from '../lib/RoleContext';

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
  zIndex: 999999, // Ensure it's very high
  backdropFilter: 'blur(4px)'
};

const modalStyle = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  width: '400px',
  maxWidth: '90%',
  padding: '24px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
  color: '#f8fafc',
  border: '1px solid rgba(255,255,255,0.1)'
};

export default function AddBusinessModal({ isOpen, onClose }) {
  const [businessName, setBusinessName] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [taxLabel, setTaxLabel] = useState('GST');
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const { refreshBusinesses } = useRole();

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!businessName.trim()) return;
    setLoading(true);
    try {
      await saveProfile(user?.id, { 
        business_name: businessName,
        currency_symbol: currencySymbol,
        tax_label: taxLabel
      }, true);
      refreshBusinesses();
      onClose();
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Failed to create new business. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏢</span> Add New Business
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
          Create a new isolated business. You can switch between your businesses anytime from the sidebar.
        </p>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Business Name</label>
          <input 
            type="text" 
            value={businessName} 
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. ABC Enterprises"
            style={{ 
              background: 'rgba(0,0,0,0.3)', 
              border: '1px solid rgba(255,255,255,0.2)', 
              borderRadius: '8px', 
              padding: '12px', 
              color: '#fff', 
              fontSize: '14px', 
              width: '100%', 
              outline: 'none' 
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Currency</label>
            <select
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              style={{
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                fontSize: '14px',
                width: '100%',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="₹">₹ (INR - India)</option>
              <option value="$">$ (USD - US Dollar)</option>
              <option value="€">€ (EUR - Euro)</option>
              <option value="£">£ (GBP - UK Pound)</option>
              <option value="৳">৳ (BDT - Bangladesh Taka)</option>
              <option value="AED">AED (UAE Dirham)</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Tax Type</label>
            <select
              value={taxLabel}
              onChange={(e) => setTaxLabel(e.target.value)}
              style={{
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                fontSize: '14px',
                width: '100%',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="GST">GST</option>
              <option value="VAT">VAT</option>
              <option value="Sales Tax">Sales Tax</option>
              <option value="Tax">General Tax</option>
              <option value="None">No Tax</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading || !businessName.trim()}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: loading || !businessName.trim() ? '#475569' : '#10B981', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            fontWeight: 'bold', 
            cursor: loading || !businessName.trim() ? 'not-allowed' : 'pointer', 
            transition: 'background 0.2s' 
          }}
        >
          {loading ? 'Creating...' : 'Create Business ✨'}
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
