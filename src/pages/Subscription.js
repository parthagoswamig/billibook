import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import PageSection from '../components/PageSection';
import { useBusiness } from '../lib/BusinessContext';
import { activatePremiumByPayPal } from '../lib/db';
import toast from 'react-hot-toast';

// ✅ PayPal Client ID টা পরে এখানে বসাও
const PAYPAL_CLIENT_ID = 'YOUR_PAYPAL_CLIENT_ID_HERE';

// ₹1999/year → USD তে convert (approx)
const PLAN_PRICE_USD = '24.00'; // $24/year ≈ ₹1999
const PLAN_PRICE_INR = '₹1999';

export default function Subscription() {
  const { profile, refresh } = useBusiness();
  const [paypalError, setPaypalError] = useState(null);
  const [activating, setActivating] = useState(false);

  const plan = profile?.plan || 'free';
  const isPremium = plan === 'premium';

  // ---- PayPal: Create Order ----
  const createOrder = (data, actions) => {
    return actions.order.create({
      purchase_units: [
        {
          description: 'KhataPe Premium Plan – 1 Year',
          amount: {
            currency_code: 'USD',
            value: PLAN_PRICE_USD,
          },
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    });
  };

  // ---- PayPal: On Approve (Payment Success) ----
  const onApprove = async (data, actions) => {
    setActivating(true);
    try {
      // Capture the order
      const order = await actions.order.capture();
      const paypalOrderId = order.id;
      const paypalPayerId = order.payer?.payer_id;

      // Activate premium in Supabase
      await activatePremiumByPayPal(paypalOrderId, paypalPayerId);
      await refresh?.();
      toast.success('🎉 Payment successful! Premium plan activated!');
    } catch (e) {
      console.error('PayPal activation error:', e);
      toast.error('Payment done but activation failed. Please contact support.');
    } finally {
      setActivating(false);
    }
  };

  // ---- PayPal: On Error ----
  const onError = (err) => {
    console.error('PayPal error:', err);
    setPaypalError('Payment failed. Please try again.');
    toast.error('Payment failed. Please try again.');
  };

  return (
    <PayPalScriptProvider
      options={{
        'client-id': PAYPAL_CLIENT_ID,
        currency: 'USD',
        intent: 'capture',
      }}
    >
      <PageSection title="Subscription Plans" icon="👑">
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

          {/* Current Plan Banner */}
          {isPremium && (
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              borderRadius: '16px', padding: '20px 28px', marginBottom: '36px',
              display: 'flex', alignItems: 'center', gap: '16px',
              boxShadow: '0 8px 25px rgba(99,102,241,0.25)'
            }}>
              <span style={{ fontSize: '40px' }}>👑</span>
              <div>
                <div style={{ color: '#fff', fontWeight: '800', fontSize: '20px' }}>
                  Premium Plan — Active!
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', marginTop: '4px' }}>
                  {profile?.paypal_order_id
                    ? `Paid via PayPal · Order: ${profile.paypal_order_id}`
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
              background: '#fff', borderRadius: '24px', padding: '40px 30px', width: '340px',
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
              width: '340px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', position: 'relative',
              display: 'flex', flexDirection: 'column',
              border: isPremium ? '2px solid #6366f1' : '2px solid transparent'
            }}>
              <div style={{
                position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff',
                padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px'
              }}>
                {isPremium ? '✓ YOUR PLAN' : 'RECOMMENDED'}
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Premium Plan</h3>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>
                {PLAN_PRICE_INR}<span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'normal' }}>/year</span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>≈ ${PLAN_PRICE_USD} USD</div>
              <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>Everything you need for a growing business.</p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '30px', flex: 1 }}>
                {['Everything in Basic', 'Multi-user & Role Management', 'Barcode POS Quick Scan', 'Advanced Customization', 'Priority WhatsApp Support', 'No KhataPe Watermark'].map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#f8fafc', fontSize: '15px', fontWeight: '500' }}>
                    <span style={{ color: '#f59e0b', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              {/* PayPal Button or Active state */}
              {isPremium ? (
                <button disabled style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
                  fontSize: '16px', fontWeight: 'bold', cursor: 'not-allowed'
                }}>
                  ✓ Active
                </button>
              ) : (
                <div>
                  {activating ? (
                    <div style={{
                      textAlign: 'center', padding: '14px', color: '#94a3b8', fontSize: '15px'
                    }}>
                      ⏳ Activating your plan...
                    </div>
                  ) : (
                    <>
                      {paypalError && (
                        <div style={{
                          color: '#ef4444', fontSize: '13px', marginBottom: '10px', textAlign: 'center'
                        }}>
                          {paypalError}
                        </div>
                      )}
                      <PayPalButtons
                        style={{
                          layout: 'vertical',
                          color: 'gold',
                          shape: 'pill',
                          label: 'pay',
                          height: 48,
                        }}
                        createOrder={createOrder}
                        onApprove={onApprove}
                        onError={onError}
                        onCancel={() => toast('Payment cancelled.')}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Secure Payment Note */}
          {!isPremium && (
            <div style={{
              textAlign: 'center', marginTop: '32px', color: '#94a3b8', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              <span>🔒</span>
              <span>Secure payment via PayPal · Cancel anytime · Instant activation</span>
            </div>
          )}

        </div>
      </PageSection>
    </PayPalScriptProvider>
  );
}
