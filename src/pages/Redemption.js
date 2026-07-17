import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageSection from '../components/PageSection';
import { redeemAppSumoCode } from '../lib/db';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import toast from 'react-hot-toast';

export default function Redemption() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId } = useUser();
  const { refresh: refreshBusiness } = useBusiness();
  const { refreshBusinesses } = useRole();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCode(codeParam);
    }
  }, [searchParams]);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter a valid code.");
      return;
    }
    setLoading(true);
    try {
      await redeemAppSumoCode(userId, code);
      toast.success("Code redeemed successfully! 🎉");
      setSuccess(true);
      refreshBusiness();
      refreshBusinesses();
    } catch (err) {
      toast.error(err.message || "Failed to redeem code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageSection title="AppSumo Redemption" icon="🎟️">
      <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px' }}>
        <div style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f8fafc',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎟️</div>
          
          {!success ? (
            <>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Redeem AppSumo Code</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
                Enter your unique AppSumo purchase code below to instantly activate your **Premium Lifetime License**.
              </p>

              <form onSubmit={handleRedeem}>
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '600' }}>AppSumo Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. AS-KHAT-XXXXX-XXXXX"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      color: '#fff',
                      fontSize: '15px',
                      width: '100%',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                    transition: 'transform 0.2s'
                  }}
                >
                  {loading ? 'Redeeming...' : 'Activate Lifetime Premium 🚀'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '12px' }}>Success! 🎉</h2>
              <p style={{ color: '#cbd5e1', fontSize: '15px', marginBottom: '24px', lineHeight: '1.6' }}>
                Congratulations! Your account has been upgraded successfully. You now have full lifetime access to **Khatape360 Premium**.
              </p>

              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                Go to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </PageSection>
  );
}
