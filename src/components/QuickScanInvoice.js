import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getParties, saveInvoice, getNextInvoiceNo, getProfile } from '../lib/db';
import { formatCurrency, addDays } from '../lib/utils';
import { useRole } from '../lib/RoleContext';
import { useBusiness } from '../lib/BusinessContext';

function QuickScanInvoice({ products, onClose, onInvoiceCreated }) {
  const { tenantId, canCreate } = useRole();
  const { currency, profile } = useBusiness();
  const fmt = (n) => formatCurrency(n, currency);

  const [cart, setCart] = useState([]);           // [{product, qty}]
  const [parties, setParties] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [scanError, setScanError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [useCamera, setUseCamera] = useState(false);
  const scannerRef = useRef(null);
  const scannerDivId = 'quick-scan-qr-reader';
  const manualInputRef = useRef(null);
  const lastScannedRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Load parties on mount
  useEffect(() => {
    if (!tenantId) return;
    getParties(tenantId, 'customer').then(pts => {
      setParties(pts || []);
      if (pts && pts.length > 0) setCustomerId(pts[0].id);
    });
  }, [tenantId]);

  // Focus manual input when not using camera
  useEffect(() => {
    if (!useCamera && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [useCamera]);

  const addToCart = useCallback((barcode) => {
    const code = (barcode || '').trim();
    if (!code) return;

    // Debounce: ignore same barcode within 1.5s (hardware scanner fires twice)
    const now = Date.now();
    if (code === lastScannedRef.current && now - lastScannedTimeRef.current < 1500) return;
    lastScannedRef.current = code;
    lastScannedTimeRef.current = now;

    // Find product by barcode, SKU, or name
    const prod = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase() === code.toLowerCase()) ||
      p.name?.toLowerCase() === code.toLowerCase()
    );

    if (!prod) {
      setScanError(`❌ No product found for: "${code}"`);
      setTimeout(() => setScanError(''), 3000);
      return;
    }

    setScanError('');
    setLastScanned(`✅ Added: ${prod.name}`);
    setTimeout(() => setLastScanned(''), 2000);

    setCart(prev => {
      const existing = prev.find(c => c.product.id === prod.id);
      if (existing) {
        return prev.map(c => c.product.id === prod.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product: prod, qty: 1, price: prod.sale_price || prod.purchase_price || 0, discount: 0, gst: prod.gst || 18, unit: prod.unit || 'Pcs' }];
    });
  }, [products]);

  // Start camera scanner
  const startCamera = useCallback(async () => {
    setScanError('');
    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 180 } },
        (decodedText) => { addToCart(decodedText); },
        () => {}
      );
      setScannerActive(true);
    } catch (err) {
      setScanError('Camera not available. Use manual input below.');
      setUseCamera(false);
    }
  }, [addToCart]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_) {}
      scannerRef.current = null;
    }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    if (useCamera) startCamera();
    else stopCamera();
    return () => { stopCamera(); };
  }, [useCamera]);

  // Manual barcode input handler (also catches hardware scanner Enter key)
  const handleManualInput = (e) => {
    if (e.key === 'Enter') {
      addToCart(manualBarcode);
      setManualBarcode('');
    }
  };

  const updateQty = (prodId, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(c => c.product.id !== prodId));
    } else {
      setCart(prev => prev.map(c => c.product.id === prodId ? { ...c, qty: newQty } : c));
    }
  };

  const updatePrice = (prodId, newPrice) => {
    setCart(prev => prev.map(c => c.product.id === prodId ? { ...c, price: newPrice } : c));
  };

  const cartTotal = cart.reduce((sum, c) => {
    const base = (parseFloat(c.qty) || 0) * (parseFloat(c.price) || 0);
    const gstAmt = base * ((parseFloat(c.gst) || 0) / 100);
    return sum + base + gstAmt;
  }, 0);

  const handleCreateInvoice = async () => {
    if (!tenantId || !customerId || cart.length === 0) return;
    if (!canCreate('invoices')) return;
    setSaving(true);
    setSaveError('');
    try {
      const businessProf = await getProfile(tenantId);
      const dueDays = businessProf?.default_due_days ?? 7;
      const invoiceNo = await getNextInvoiceNo(tenantId, 'sale', 'sale_invoice');
      const today = new Date().toISOString().split('T')[0];

      const items = cart.map(c => {
        const qty = parseFloat(c.qty) || 1;
        const price = parseFloat(c.price) || 0;
        const gst = parseFloat(c.gst) || 0;
        const base = qty * price;
        return {
          product_id: c.product.id,
          name: c.product.name,
          hsn: c.product.hsn || '',
          qty, price, gst,
          unit: c.unit || 'Pcs',
          discount: 0,
          amount: base + base * (gst / 100),
        };
      });

      let subtotal = 0, gstAmount = 0;
      items.forEach(i => {
        const base = i.qty * i.price;
        subtotal += base;
        gstAmount += base * (i.gst / 100);
      });
      const total = subtotal + gstAmount;

      const inv = await saveInvoice(tenantId, {
        type: 'sale', document_kind: 'sale_invoice',
        invoice_no: invoiceNo,
        customer_id: customerId,
        date: today,
        due_date: addDays(today, dueDays),
        subtotal, gst_amount: gstAmount,
        discount: 0, round_off: 0, shipping_charges: 0,
        state_of_supply: businessProf?.state || '',
        total, paid: 0, balance: total,
        status: 'unpaid',
        last_payment_mode: null,
        warehouse_id: null,
        notes: 'Created via Quick Scan',
      }, items);

      onInvoiceCreated(inv.id);
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '880px',
        maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: '800' }}>🔍 Quick Scan & Bill</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '4px 0 0', fontSize: '13px' }}>
              Scan barcodes to instantly add products to invoice
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
          {/* LEFT: Scanner Panel */}
          <div style={{ flex: '1 1 320px', borderRight: '1px solid #e2e8f0', padding: '20px', overflowY: 'auto', background: '#f8fafc' }}>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button
                onClick={() => setUseCamera(true)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                  background: useCamera ? '#1e293b' : '#fff', color: useCamera ? '#fff' : '#64748b',
                  boxShadow: useCamera ? '0 4px 12px rgba(30,41,59,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >📷 Camera Scan</button>
              <button
                onClick={() => setUseCamera(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                  background: !useCamera ? '#1e293b' : '#fff', color: !useCamera ? '#fff' : '#64748b',
                  boxShadow: !useCamera ? '0 4px 12px rgba(30,41,59,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >⌨️ Manual / USB Scanner</button>
            </div>

            {/* Camera View */}
            {useCamera && (
              <div style={{ marginBottom: '16px' }}>
                <div id={scannerDivId} style={{ borderRadius: '12px', overflow: 'hidden', border: '2px solid #e2e8f0' }} />
                {scannerActive && (
                  <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    📡 Scanner active — point camera at barcode
                  </p>
                )}
              </div>
            )}

            {/* Manual / USB Input */}
            {!useCamera && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
                  Barcode / SKU
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={manualInputRef}
                    type="text"
                    placeholder="Scan or type barcode, press Enter"
                    value={manualBarcode}
                    onChange={e => setManualBarcode(e.target.value)}
                    onKeyDown={handleManualInput}
                    style={{
                      flex: 1, padding: '12px 14px', borderRadius: '10px', border: '2px solid #e2e8f0',
                      fontSize: '14px', outline: 'none', fontFamily: 'monospace',
                      background: '#fff'
                    }}
                    autoComplete="off"
                  />
                  <button
                    onClick={() => { addToCart(manualBarcode); setManualBarcode(''); }}
                    style={{
                      padding: '12px 16px', background: '#3b82f6', color: '#fff', border: 'none',
                      borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px'
                    }}
                  >Add</button>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                  💡 USB barcode scanners work automatically — just scan!
                </p>
              </div>
            )}

            {/* Feedback */}
            {lastScanned && (
              <div style={{ background: '#dcfce7', color: '#16a34a', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
                {lastScanned}
              </div>
            )}
            {scanError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
                {scanError}
              </div>
            )}

            {/* Quick Product List for reference */}
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
                Products with Barcode ({products.filter(p => p.barcode).length})
              </p>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {products.filter(p => p.barcode).map(p => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p.barcode)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                      background: '#fff', marginBottom: '4px', border: '1px solid #e2e8f0',
                      transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{p.barcode}</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6' }}>+ Add</span>
                  </div>
                ))}
                {products.filter(p => p.barcode).length === 0 && (
                  <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
                    No products with barcode yet.<br/>Add barcodes in Products page.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Cart Panel */}
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Cart Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>
                  🛒 Cart ({cart.length} items)
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                  >Clear All</button>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                  <p style={{ fontWeight: '600', fontSize: '15px', margin: 0 }}>Cart is empty</p>
                  <p style={{ fontSize: '13px', margin: '8px 0 0' }}>Scan a barcode to add products</p>
                </div>
              ) : (
                cart.map((c) => {
                  const qty = parseFloat(c.qty) || 0;
                  const price = parseFloat(c.price) || 0;
                  const gst = parseFloat(c.gst) || 0;
                  const base = qty * price;
                  const rowTotal = base + base * (gst / 100);
                  return (
                    <div key={c.product.id} style={{
                      background: '#f8fafc', borderRadius: '12px', padding: '14px',
                      marginBottom: '10px', border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{c.product.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            GST: {gst}% | {c.unit}
                            {c.product.barcode && <span style={{ fontFamily: 'monospace', marginLeft: '8px', color: '#94a3b8' }}>{c.product.barcode}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => setCart(prev => prev.filter(x => x.product.id !== c.product.id))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                        >×</button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Qty control */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                          <button onClick={() => updateQty(c.product.id, c.qty - 1)} style={{ border: 'none', background: 'none', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', color: '#ef4444', fontWeight: '700' }}>−</button>
                          <input
                            type="number"
                            value={c.qty}
                            onChange={e => updateQty(c.product.id, parseFloat(e.target.value) || 1)}
                            style={{ width: '44px', border: 'none', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#1e293b', background: 'none', outline: 'none' }}
                            min="0.01" step="0.01"
                          />
                          <button onClick={() => updateQty(c.product.id, c.qty + 1)} style={{ border: 'none', background: 'none', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', color: '#10b981', fontWeight: '700' }}>+</button>
                        </div>
                        {/* Price */}
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            value={c.price}
                            onChange={e => updatePrice(c.product.id, parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'monospace' }}
                            min="0" step="0.01" placeholder="Price"
                          />
                        </div>
                        {/* Row total */}
                        <div style={{ minWidth: '70px', textAlign: 'right', fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                          {fmt(rowTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
              {/* Customer Select */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Customer *</label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '14px', background: '#f8fafc', outline: 'none', fontWeight: '600' }}
                >
                  <option value="">Select Customer</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>)}
                </select>
              </div>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #f1f5f9', marginBottom: '12px' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#64748b' }}>Total Amount (incl. GST):</span>
                <span style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b' }}>{fmt(cartTotal)}</span>
              </div>

              {saveError && (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '10px', fontWeight: '600' }}>
                  {saveError}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}
                >Cancel</button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={cart.length === 0 || !customerId || saving}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                    background: cart.length === 0 || !customerId ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    color: '#fff', fontWeight: '800', cursor: cart.length === 0 || !customerId ? 'not-allowed' : 'pointer',
                    fontSize: '15px', boxShadow: cart.length > 0 && customerId ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {saving ? '⏳ Creating...' : `🧾 Create Invoice (${cart.length} items)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickScanInvoice;
