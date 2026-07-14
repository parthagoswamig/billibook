import React from 'react';
import PageSection from '../components/PageSection';
import { useBusiness } from '../lib/BusinessContext';

export default function Subscription() {
  const { business } = useBusiness();
  const phone = "917908789954";

  const handleUpgrade = (plan) => {
    const text = `Hi, I want to upgrade my KhataPe account to the *${plan}* plan. Business Name: ${business?.name || 'Unknown'}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <PageSection title="Subscription Plans" icon="👑">
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', color: '#1e293b', marginBottom: '12px', fontWeight: '800' }}>Choose the Right Plan for Your Business</h2>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Upgrade to Premium and unlock advanced features to scale your business.</p>
        </div>

        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
          
          {/* Basic Plan */}
          <div style={{ 
            background: '#fff', borderRadius: '24px', padding: '40px 30px', width: '350px', 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>Basic Plan</h3>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#1e293b', marginBottom: '20px' }}>
              Free
            </div>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>Essential features for getting started.</p>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '30px', flex: 1 }}>
              {['Unlimited Invoices', 'Basic Inventory', 'Customer Management', 'Standard Reports'].map((feature, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#475569', fontSize: '15px', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span> {feature}
                </li>
              ))}
              {['Multi-user Access', 'Advanced Customization', 'Barcode Quick Scan'].map((feature, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#94a3b8', fontSize: '15px' }}>
                  <span style={{ color: '#cbd5e1', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✕</span> {feature}
                </li>
              ))}
            </ul>

            <button 
              disabled
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1',
                background: '#f8fafc', color: '#64748b', fontSize: '16px', fontWeight: 'bold', cursor: 'not-allowed'
              }}
            >
              Current Plan
            </button>
          </div>

          {/* Premium Plan */}
          <div style={{ 
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', padding: '40px 30px', 
            width: '350px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', position: 'relative',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ 
              position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', 
              padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px'
            }}>
              RECOMMENDED
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Premium Plan</h3>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '20px' }}>
              ₹999<span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'normal' }}>/year</span>
            </div>
            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>Everything you need for a growing business.</p>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '30px', flex: 1 }}>
              {['Everything in Basic', 'Multi-user & Role Management', 'Barcode POS Quick Scan', 'Advanced Customization', 'Priority WhatsApp Support', 'No KhataPe Watermark'].map((feature, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#f8fafc', fontSize: '15px', fontWeight: '500' }}>
                  <span style={{ color: '#f59e0b', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span> {feature}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => handleUpgrade('Premium')}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', 
                fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Upgrade Now
            </button>
          </div>

        </div>
      </div>
    </PageSection>
  );
}
