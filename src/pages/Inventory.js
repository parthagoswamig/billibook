import React, { useEffect, useState } from 'react';
import { useUser } from '../lib/useUser';
import { useRole } from '../lib/RoleContext';
import { 
  getProducts, 
  getInventoryValuation, 
  getStockAdjustments, 
  createStockAdjustment, 
  getStockTransfers, 
  createStockTransfer,
  getLowStockProducts,
  getWarehouses,
  createWarehouse,
  deleteWarehouse,
  getWarehouseStocks
} from '../lib/db';
import { formatCurrency, formatDate } from '../lib/utils';
import './Inventory.css';

function Inventory() {
  const { tenantId } = useRole();
  const { canCreate } = useRole();
  const [products, setProducts] = useState([]);
  const [valuation, setValuation] = useState({ totalPurchaseValue: 0, totalSaleValue: 0, totalItems: 0 });
  const [adjustments, setAdjustments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseStocks, setWarehouseStocks] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [adjForm, setAdjForm] = useState({ product_id: '', warehouse_id: '', qty: '', reason: 'Inventory Audit' });
  const [transferForm, setTransferForm] = useState({ product_id: '', from_warehouse_id: '', to_warehouse_id: '', qty: '' });
  const [newWarehouse, setNewWarehouse] = useState({ name: '', code: '', address: '' });

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const [prods, val, adjs, trans, low, whs, whStocks] = await Promise.all([
        getProducts(tenantId),
        getInventoryValuation(tenantId),
        getStockAdjustments(tenantId),
        getStockTransfers(tenantId),
        getLowStockProducts(tenantId, 10),
        getWarehouses(tenantId),
        getWarehouseStocks(tenantId)
      ]);
      setProducts(prods || []);
      setValuation(val || { totalPurchaseValue: 0, totalSaleValue: 0, totalItems: 0 });
      setAdjustments(adjs || []);
      setTransfers(trans || []);
      setLowStock(low || []);
      setWarehouses(whs || []);
      setWarehouseStocks(whStocks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate()) {
      setError('Permission denied: You do not have access to modify stock.');
      return;
    }
    if (!adjForm.product_id || !adjForm.qty) {
      setError('Please select a product and specify quantity');
      return;
    }
    try {
      setError('');
      await createStockAdjustment(tenantId, {
        product_id: adjForm.product_id,
        warehouse_id: adjForm.warehouse_id || null,
        qty: parseFloat(adjForm.qty),
        reason: adjForm.reason
      });
      setSuccessMsg('Stock adjustment recorded successfully');
      setAdjForm({ product_id: '', warehouse_id: '', qty: '', reason: 'Inventory Audit' });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to record stock adjustment');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate()) {
      setError('Permission denied: You do not have access to modify stock.');
      return;
    }
    if (!transferForm.product_id || !transferForm.qty) {
      setError('Please select a product and specify quantity');
      return;
    }
    if (!transferForm.from_warehouse_id || !transferForm.to_warehouse_id) {
      setError('Please select both source and destination warehouses');
      return;
    }
    if (transferForm.from_warehouse_id === transferForm.to_warehouse_id) {
      setError('Source and destination warehouses cannot be the same');
      return;
    }

    const fromWarehouse = warehouses.find(w => w.id === transferForm.from_warehouse_id);
    const toWarehouse = warehouses.find(w => w.id === transferForm.to_warehouse_id);

    try {
      setError('');
      await createStockTransfer(tenantId, {
        product_id: transferForm.product_id,
        from_location: fromWarehouse ? fromWarehouse.name : 'Unknown',
        to_location: toWarehouse ? toWarehouse.name : 'Unknown',
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        qty: parseFloat(transferForm.qty)
      });
      setSuccessMsg('Stock transfer logged successfully');
      setTransferForm({ product_id: '', from_warehouse_id: '', to_warehouse_id: '', qty: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to log stock transfer');
    }
  };

  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate()) {
      setError('Permission denied: You do not have access to create warehouses.');
      return;
    }
    if (!newWarehouse.name) {
      setError('Please specify a warehouse name');
      return;
    }
    try {
      setError('');
      await createWarehouse(tenantId, newWarehouse);
      setSuccessMsg('Warehouse created successfully');
      setNewWarehouse({ name: '', code: '', address: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create warehouse');
    }
  };

  const handleDeleteWarehouse = async (id) => {
    if (!window.confirm('Are you sure you want to delete this warehouse?')) return;
    try {
      setError('');
      await deleteWarehouse(id);
      setSuccessMsg('Warehouse deleted successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete warehouse');
    }
  };

  const getProductStockStatus = (prod) => {
    const qty = parseFloat(prod.stock) || 0;
    const minStock = parseFloat(prod.min_stock) || 0;
    if (qty <= 0) return <span className="badge badge-danger">Out of Stock</span>;
    if (minStock > 0 && qty <= minStock) return <span className="badge badge-warning">Low Stock ({qty})</span>;
    return <span className="badge badge-success">In Stock ({qty})</span>;
  };

  return (
    <div className="inventory-container">
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>🏬 Inventory Engine</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Monitor stock value, track warehouse transfers, and perform adjustments.
          </p>
        </div>
        <button className="btn-inventory" onClick={loadData} style={{ background: 'var(--border)', color: 'var(--text-primary)' }}>
          🔄 Refresh
        </button>
      </div>

      {successMsg && <div className="form-message form-success" style={{ marginBottom: '20px' }}>{successMsg}</div>}
      {error && <div className="form-message form-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Valuation Cards */}
      <div className="inventory-grid">
        <div className="valuation-card primary">
          <span className="valuation-card-title">Stock Value (Purchase Rate)</span>
          <span className="valuation-card-value">{formatCurrency(valuation.totalPurchaseValue)}</span>
          <div className="valuation-card-meta">
            <span>Asset Valuation</span>
            <span>{valuation.totalItems} distinct items</span>
          </div>
        </div>
        
        <div className="valuation-card success">
          <span className="valuation-card-title">Stock Value (Selling Rate)</span>
          <span className="valuation-card-value">{formatCurrency(valuation.totalSaleValue)}</span>
          <div className="valuation-card-meta">
            <span>Potential Revenue</span>
            <span>Margin: {formatCurrency(Math.max(0, valuation.totalSaleValue - valuation.totalPurchaseValue))}</span>
          </div>
        </div>

        <div className="valuation-card warning">
          <span className="valuation-card-title">Low Stock Items</span>
          <span className="valuation-card-value">{lowStock.length}</span>
          <div className="valuation-card-meta">
            <span>Requires replenishment</span>
            <span>Based on product min stock limits</span>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div className="low-stock-banner">
          <div className="low-stock-banner-content">
            <span className="low-stock-banner-icon">⚠️</span>
            <div className="low-stock-banner-text">
              <h4>Low Stock Alerts Detected</h4>
              <p>{lowStock.map(p => `${p.name} (${p.stock} ${p.unit || 'pcs'})`).join(', ')} need(s) restocking.</p>
            </div>
          </div>
          <button 
            className="btn-inventory" 
            style={{ background: '#DC2626', color: 'white' }}
            onClick={() => {
              setActiveTab('adjust');
              if (lowStock.length > 0) {
                setAdjForm(prev => ({ ...prev, product_id: lowStock[0].id }));
              }
            }}
          >
            Replenish Stock
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="inventory-tabs">
        <button className={`inventory-tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
          📦 Stock Summary
        </button>
        <button className={`inventory-tab-btn ${activeTab === 'adjust' ? 'active' : ''}`} onClick={() => setActiveTab('adjust')}>
          ⚡ Manual Adjustments
        </button>
        <button className={`inventory-tab-btn ${activeTab === 'transfer' ? 'active' : ''}`} onClick={() => setActiveTab('transfer')}>
          🚚 Stock Transfers
        </button>
        <button className={`inventory-tab-btn ${activeTab === 'warehouses' ? 'active' : ''}`} onClick={() => setActiveTab('warehouses')}>
          🏢 Warehouse Locations
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="empty-state">Loading inventory engine data...</div>
      ) : (
        <>
          {activeTab === 'summary' && (
            <div className="inventory-card">
              <div className="card-header-flex">
                <h3>Product Stock Breakdown</h3>
              </div>
              <div className="simple-table-wrapper">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>HSN</th>
                      <th>Purchase Price</th>
                      <th>Sale Price</th>
                      <th>Stock Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No products found. Add products in the Products page.</td>
                      </tr>
                    ) : (
                      products.map((prod) => (
                        <tr key={prod.id} className={(parseFloat(prod.stock) <= (prod.min_stock || 0) && (prod.min_stock || 0) > 0) ? 'product-row-alert' : ''}>
                          <td><strong>{prod.name}</strong></td>
                          <td>{prod.hsn || '—'}</td>
                          <td>{formatCurrency(prod.purchase_price)}</td>
                          <td>{formatCurrency(prod.sale_price)}</td>
                          <td>{prod.stock} {prod.unit || 'pcs'}</td>
                          <td>{getProductStockStatus(prod)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'adjust' && (
            <div className="split-layout">
              {/* Form */}
              <div className="inventory-card">
                <h3>Record Stock Adjustment</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Add or subtract items from the active stock. Negative quantities deduct stock.
                </p>
                <form onSubmit={handleAdjustmentSubmit}>
                  <div className="form-group-inventory">
                    <label>Select Product *</label>
                    <select 
                      className="form-control-inventory" 
                      value={adjForm.product_id}
                      onChange={(e) => setAdjForm({ ...adjForm, product_id: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Current: {p.stock})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-inventory">
                    <label>Select Warehouse (Optional)</label>
                    <select 
                      className="form-control-inventory" 
                      value={adjForm.warehouse_id}
                      onChange={(e) => setAdjForm({ ...adjForm, warehouse_id: e.target.value })}
                    >
                      <option value="">-- Global / No Warehouse --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} {w.code ? `(${w.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group-inventory">
                    <label>Quantity Change *</label>
                    <input 
                      type="number" 
                      className="form-control-inventory"
                      placeholder="e.g. +50 or -10"
                      value={adjForm.qty}
                      onChange={(e) => setAdjForm({ ...adjForm, qty: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group-inventory">
                    <label>Reason / Remarks *</label>
                    <select 
                      className="form-control-inventory"
                      value={adjForm.reason}
                      onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                      required
                    >
                      <option value="Inventory Audit">Inventory Audit</option>
                      <option value="Stock Replenishment">Stock Replenishment</option>
                      <option value="Damaged Goods">Damaged Goods</option>
                      <option value="Theft or Loss">Theft or Loss</option>
                      <option value="Correction">Correction</option>
                    </select>
                  </div>

                  <button type="submit" className="btn-inventory" style={{ width: '100%', marginTop: '10px' }}>
                    Save Stock Adjustment
                  </button>
                </form>
              </div>

              {/* Logs */}
              <div className="inventory-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>Recent Stock Adjustments</h3>
                <div className="logs-table-container" style={{ flex: 1, marginTop: '16px' }}>
                  {adjustments.length === 0 ? (
                    <div className="empty-logs">No adjustments logged yet.</div>
                  ) : (
                    <table className="simple-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Change</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjustments.map((adj) => (
                          <tr key={adj.id}>
                            <td>{formatDate(adj.created_at)}</td>
                            <td><strong>{adj.products?.name}</strong></td>
                            <td style={{ color: parseFloat(adj.qty) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                              {parseFloat(adj.qty) >= 0 ? `+${adj.qty}` : adj.qty}
                            </td>
                            <td>{adj.reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="split-layout">
              {/* Form */}
              <div className="inventory-card">
                <h3>Log Stock Transfer</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Document product stock movements between storage branches, showrooms, or warehouses.
                </p>
                <form onSubmit={handleTransferSubmit}>
                  <div className="form-group-inventory">
                    <label>Select Product *</label>
                    <select 
                      className="form-control-inventory" 
                      value={transferForm.product_id}
                      onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Current: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group-inventory" style={{ flex: 1 }}>
                      <label>From Warehouse *</label>
                      <select 
                        className="form-control-inventory"
                        value={transferForm.from_warehouse_id}
                        onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Warehouse --</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group-inventory" style={{ flex: 1 }}>
                      <label>To Warehouse *</label>
                      <select 
                        className="form-control-inventory"
                        value={transferForm.to_warehouse_id}
                        onChange={(e) => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Warehouse --</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group-inventory">
                    <label>Quantity *</label>
                    <input 
                      type="number" 
                      className="form-control-inventory"
                      placeholder="e.g. 20"
                      value={transferForm.qty}
                      onChange={(e) => setTransferForm({ ...transferForm, qty: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-inventory" style={{ width: '100%', marginTop: '10px' }}>
                    Record Location Transfer
                  </button>
                </form>
              </div>

              {/* Logs */}
              <div className="inventory-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>Recent Location Transfers</h3>
                <div className="logs-table-container" style={{ flex: 1, marginTop: '16px' }}>
                  {transfers.length === 0 ? (
                    <div className="empty-logs">No transfers logged yet.</div>
                  ) : (
                    <table className="simple-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Route</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((t) => (
                          <tr key={t.id}>
                            <td>{formatDate(t.created_at)}</td>
                            <td><strong>{t.products?.name}</strong></td>
                            <td>{t.qty}</td>
                            <td><span style={{ color: 'var(--text-secondary)' }}>{t.from_location}</span> ➔ <span style={{ color: 'var(--accent)' }}>{t.to_location}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'warehouses' && (
            <div className="split-layout">
              {/* Form */}
              <div className="inventory-card">
                <h3>Add New Warehouse</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Define branches, storage zones or retail areas.
                </p>
                <form onSubmit={handleWarehouseSubmit}>
                  <div className="form-group-inventory">
                    <label>Warehouse Name *</label>
                    <input 
                      type="text" 
                      className="form-control-inventory"
                      placeholder="e.g. Downtown Warehouse"
                      value={newWarehouse.name}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group-inventory">
                    <label>Warehouse Code / Short Code</label>
                    <input 
                      type="text" 
                      className="form-control-inventory"
                      placeholder="e.g. WH-DNTN"
                      value={newWarehouse.code}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value })}
                    />
                  </div>

                  <div className="form-group-inventory">
                    <label>Address</label>
                    <textarea 
                      className="form-control-inventory"
                      placeholder="Street, City, Zip"
                      style={{ height: '70px', resize: 'vertical' }}
                      value={newWarehouse.address}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn-inventory" style={{ width: '100%', marginTop: '10px' }}>
                    Save Warehouse
                  </button>
                </form>
              </div>

              {/* List */}
              <div className="inventory-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>Active Warehouses</h3>
                <div className="logs-table-container" style={{ flex: 1, marginTop: '16px' }}>
                  {warehouses.length === 0 ? (
                    <div className="empty-logs">No warehouses defined yet.</div>
                  ) : (
                    <table className="simple-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Address</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warehouses.map((wh) => (
                          <tr key={wh.id}>
                            <td><code>{wh.code || '—'}</code></td>
                            <td><strong>{wh.name}</strong></td>
                            <td>{wh.address || '—'}</td>
                            <td>
                              <button 
                                className="btn-delete" 
                                style={{ background: '#DC2626', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                onClick={() => handleDeleteWarehouse(wh.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <h3 style={{ marginTop: '24px' }}>Warehouse Stock Inventory</h3>
                <div className="logs-table-container" style={{ flex: 1, marginTop: '12px' }}>
                  {warehouseStocks.length === 0 ? (
                    <div className="empty-logs">No stock allocated to warehouses.</div>
                  ) : (
                    <table className="simple-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Warehouse</th>
                          <th>Product</th>
                          <th>Stock Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warehouseStocks.map((ws) => (
                          <tr key={ws.id}>
                            <td>{ws.warehouses?.name || '—'}</td>
                            <td><strong>{ws.products?.name || '—'}</strong></td>
                            <td>{ws.stock} {ws.products?.unit || 'pcs'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Inventory;
