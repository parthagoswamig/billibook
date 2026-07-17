import React, { useState } from 'react';
import PageSection from '../components/PageSection';
import { useBusiness } from '../lib/BusinessContext';
import { redeemAppSumoCode } from '../lib/db';
import toast from 'react-hot-toast';

export default function Subscription() {
  const { profile, refresh } = useBusiness();
  const phone = "917908789954";
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const plan = profile?.plan || 'free';
  const isPremium = plan === 'premium';
  const isAppSumo = profile?.appsumo_code;

  const handleUpgrade = () => {
    const text = `Hi, I want to upgrade my KhataPe account to the *Premium* plan. Business Name: ${profile?.business_name || 'Unknown'}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleRedeem = async () => {
    if (!code.trim()) return toast.error('Please enter a code');
    setRedeeming(true);
    try {
      await redeemAppSumoCode(null, code.trim().toUpperCase());
      toast.success('🎉 AppSumo code redeemed! Lifetime Premium activated!');
      await refresh?.();
    } catch (e) {
      toast.error(e.message || 'Invalid or already redeemed code');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <PageSection title="Subscription Plans" icon="👑">
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px' }}>

        {/* Current Plan Banner */}
        {isPremium && (
          <div style={{
            background: isAppSumo
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            borderRadius: '16px', padding: '20px 28px', marginBottom: '36px',
            display: 'flex', alignItems: 'center', gap: '16px',
            boxShadow: '0 8px 25px rgba(99,102,241,0.25)'
          }}>
            <span style={{ fontSize: '40px' }}>{isAppSumo ? '🏆' : '👑'}</span>
            <div>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '20px' }}>
                {isAppSumo ? 'AppSumo Lifetime Deal — Active!' : 'Premium Plan — Active!'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', marginTop: '4px' }}>
                {isAppSumo
                  ? `Redeemed with code: ${profile.appsumo_code} · Lifetime access to all premium features.`
                  : 'You have full access to all premium features.'}
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', color: '#1e293b', marginBottom: '12px', fontWeight: '800' }}>
            Choose the Right Plan for Your Business
          </h2>
          <p style={{ color: '#64748b', fontSize: '16px' }}>
            Upgrade to Premium and unlock advanced features to scale your business.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>

          {/* Basic Plan */}
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '40px 30px', width: '350px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: `2px solid ${!isPremium ? '#6366f1' : '#e2e8f0'}`,
            display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>Basic Plan</h3>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#1e293b', marginBottom: '20px' }}>Free</div>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>Essential features for getting started.</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '30px', flex: 1 }}>
              {['Unlimited Invoices', 'Basic Inventory', 'Customer Management', 'Standard Reports'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#475569', fontSize: '15px', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span> {f}
                </li>
              ))}
              {['Multi-user Access', 'Advanced Customization', 'Barcode Quick Scan'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#94a3b8', fontSize: '15px' }}>
                  <span style={{ color: '#cbd5e1', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✕</span> {f}
                </li>
              ))}
            </ul>

            <button disabled style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1',
              background: !isPremium ? '#6366f1' : '#f8fafc',
              color: !isPremium ? '#fff' : '#64748b',
              fontSize: '16px', fontWeight: 'bold', cursor: 'not-allowed'
            }}>
              {!isPremium ? '✓ Current Plan' : 'Free Plan'}
            </button>
          </div>

          {/* Premium Plan */}
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', padding: '40px 30px',
            width: '350px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', position: 'relative',
            display: 'flex', flexDirection: 'column',
            border: isPremium && !isAppSumo ? '2px solid #6366f1' : '2px solid transparent'
          }}>
            <div style={{
              position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff',
              padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px'
            }}>
              {isPremium && !isAppSumo ? '✓ YOUR PLAN' : 'RECOMMENDED'}
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Premium Plan</h3>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '20px' }}>
              ₹999<span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'normal' }}>/year</span>
            </div>
            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>Everything you need for a growing business.</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '30px', flex: 1 }}>
              {['Everything in Basic', 'Multi-user & Role Management', 'Barcode POS Quick Scan', 'Advanced Customization', 'Priority WhatsApp Support', 'No KhataPe Watermark'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#f8fafc', fontSize: '15px', fontWeight: '500' }}>
                  <span style={{ color: '#f59e0b', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span> {f}
                </li>
              ))}
            </ul>

            {isPremium && !isAppSumo ? (
              <button disabled style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
                fontSize: '16px', fontWeight: 'bold', cursor: 'not-allowed'
              }}>
                ✓ Active
              </button>
            ) : !isPremium ? (
              <button
                onClick={handleUpgrade}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff',
                  fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)', transition: 'transform 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                Upgrade Now via WhatsApp
              </button>
            ) : null}
          </div>

          {/* AppSumo Lifetime Plan */}
          <div style={{
            background: 'linear-gradient(180deg, #78350f 0%, #451a03 100%)', borderRadius: '24px', padding: '40px 30px',
            width: '350px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', position: 'relative',
            display: 'flex', flexDirection: 'column',
            border: isAppSumo ? '2px solid #f59e0b' : '2px solid transparent'
          }}>
            <div style={{
              position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff',
              padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px'
            }}>
              {isAppSumo ? '✓ ACTIVE' : '🔥 APPSUMO DEAL'}
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fef3c7', marginBottom: '8px' }}>Lifetime Deal</h3>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#fef3c7', marginBottom: '4px' }}>
              One-time
            </div>
            <div style={{ fontSize: '14px', color: '#fbbf24', marginBottom: '20px' }}>via AppSumo · Never pay again</div>
            <p style={{ color: '#d97706', marginBottom: '24px', fontSize: '14px' }}>All Premium features. Forever. One payment.</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '30px', flex: 1 }}>
              {['Everything in Premium', '5 Team Seats per Code', 'Lifetime Updates', 'AppSumo Refund Guarantee', 'Priority Support'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#fef9c3', fontSize: '15px', fontWeight: '500' }}>
                  <span style={{ color: '#fbbf24', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span> {f}
                </li>
              ))}
            </ul>

            {isAppSumo ? (
              <button disabled style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
                fontSize: '16px', fontWeight: 'bold', cursor: 'not-allowed'
              }}>
                ✓ Lifetime Access Active
              </button>
            ) : (
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Enter AppSumo code (AS-KHAT-XXXXX)"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #92400e',
                    background: 'rgba(255,255,255,0.1)', color: '#fef3c7', fontSize: '14px',
                    marginBottom: '10px', boxSizing: 'border-box', outline: 'none',
                    fontFamily: 'monospace', letterSpacing: '1px'
                  }}
                />
                <button
                  onClick={handleRedeem}
                  disabled={redeeming}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                    background: redeeming
                      ? 'rgba(255,255,255,0.2)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#1c1917', fontSize: '16px', fontWeight: '800',
                    cursor: redeeming ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(245,158,11,0.4)', transition: 'transform 0.2s'
                  }}
                  onMouseOver={e => { if (!redeeming) e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {redeeming ? '⏳ Activating...' : '🏷️ Redeem AppSumo Code'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </PageSection>
  );
}
