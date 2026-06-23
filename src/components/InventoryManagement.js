import React, { useEffect, useState } from 'react';
import { useUser } from '../lib/useUser';
import { useRole } from '../lib/RoleContext';
import { 
  getLowStockProducts, 
  updateProductStock, 
  createStockAlert, 
  getStockAlerts, 
  updateStockAlertStatus, 
  deleteStockAlert 
} from '../lib/db';
import { formatCurrency } from '../lib/utils';

function InventoryManagement({ tenantId }) {
  const { userId } = useUser();
  const activeTenantId = tenantId || userId;
  const { canCreate, canEdit, canDelete } = useRole();
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    product_id: '',
    threshold: 10,
    alert_type: 'low_stock'
  });

  const [stockUpdateForm, setStockUpdateForm] = useState({
    product_id: '',
    quantity: 0,
    operation: 'add'
  });

  useEffect(() => {
    loadInventoryData();
  }, [activeTenantId]);

  const loadInventoryData = async () => {
    if (!activeTenantId) return;
    try {
      const [lowStock, alerts] = await Promise.all([
        getLowStockProducts(activeTenantId, 10),
        getStockAlerts(activeTenantId)
      ]);
      setLowStockProducts(lowStock);
      setStockAlerts(alerts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!activeTenantId) return;
    if (!canCreate()) return;
    
    try {
      await createStockAlert(activeTenantId, form);
      setMessage('✓ Stock alert created successfully');
      setShowModal(false);
      setForm({ product_id: '', threshold: 10, alert_type: 'low_stock' });
      loadInventoryData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create alert');
    }
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!activeTenantId || !stockUpdateForm.product_id) return;
    if (!canEdit()) return;
    
    try {
      await updateProductStock(stockUpdateForm.product_id, stockUpdateForm.quantity, stockUpdateForm.operation);
      setMessage('✓ Stock updated successfully');
      setStockUpdateForm({ product_id: '', quantity: 0, operation: 'add' });
      loadInventoryData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update stock');
    }
  };

  const handleResolveAlert = async (alertId) => {
    if (!canEdit()) return;
    try {
      await updateStockAlertStatus(alertId, 'resolved');
      setMessage('✓ Alert resolved successfully');
      loadInventoryData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to resolve alert');
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!canDelete()) return;
    if (!confirm('Are you sure you want to delete this alert?')) return;
    
    try {
      await deleteStockAlert(alertId);
      setMessage('✓ Alert deleted successfully');
      loadInventoryData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete alert');
    }
  };

  const getStockLevel = (stock, threshold) => {
    if (stock === 0) return { level: 'critical', color: 'var(--danger)', label: 'Out of Stock' };
    if (stock <= threshold / 2) return { level: 'critical', color: 'var(--danger)', label: 'Critical' };
    if (stock <= threshold) return { level: 'low', color: 'var(--warning)', label: 'Low Stock' };
    return { level: 'good', color: 'var(--success)', label: 'In Stock' };
  };

  if (loading) return <div className="loading-screen">Loading inventory...</div>;

  return (
    <div className="inventory-management">
      <div className="inventory-header">
        <h2>📦 Inventory Management</h2>
        <div className="inventory-stats">
          <div className="stat-item">
            <span className="stat-label">Low Stock</span>
            <span className="stat-value critical">{lowStockProducts.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Active Alerts</span>
            <span className="stat-value warning">{stockAlerts.length}</span>
          </div>
        </div>
      </div>

      {message && <p className="form-message form-success">{message}</p>}
      {error && <p className="form-message form-error">{error}</p>}

      {/* Quick Stock Update */}
      {canEdit() && (
        <div className="inventory-section">
          <h3>⚡ Quick Stock Update</h3>
          <form onSubmit={handleStockUpdate} className="quick-stock-form">
            <div className="form-row">
              <select 
                className="form-input"
                value={stockUpdateForm.product_id}
                onChange={(e) => setStockUpdateForm({ ...stockUpdateForm, product_id: e.target.value })}
                required
              >
                <option value="">Select Product...</option>
                {lowStockProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - Current: {product.stock} {product.unit}
                  </option>
                ))}
              </select>
              <select 
                className="form-input"
                value={stockUpdateForm.operation}
                onChange={(e) => setStockUpdateForm({ ...stockUpdateForm, operation: e.target.value })}
              >
                <option value="add">Add Stock</option>
                <option value="remove">Remove Stock</option>
              </select>
              <input 
                type="number" 
                className="form-input"
                placeholder="Quantity"
                value={stockUpdateForm.quantity}
                onChange={(e) => setStockUpdateForm({ ...stockUpdateForm, quantity: parseInt(e.target.value) || 0 })}
                min="1"
                required
              />
              <button type="submit" className="primary-button">Update</button>
            </div>
          </form>
        </div>
      )}

      {/* Low Stock Products */}
      <div className="inventory-section">
        <div className="section-header">
          <h3>⚠️ Low Stock Products</h3>
          {canCreate() && (
            <button 
              className="secondary-button" 
              onClick={() => setShowModal(true)}
              type="button"
            >
              + Create Alert
            </button>
          )}
        </div>
        
        {lowStockProducts.length === 0 ? (
          <p className="muted-text">All products are well stocked!</p>
        ) : (
          <div className="products-grid">
            {lowStockProducts.map((product) => {
              const stockInfo = getStockLevel(product.stock, product.min_stock || 10);
              return (
                <div key={product.id} className="product-card">
                  <div className="product-header">
                    <span className="product-name">{product.name}</span>
                    <span className={`stock-badge ${stockInfo.level}`} style={{ background: stockInfo.color }}>
                      {stockInfo.label}
                    </span>
                  </div>
                  <div className="product-details">
                    <div className="detail-item">
                      <span className="detail-label">Current Stock:</span>
                      <span className="detail-value">{product.stock} {product.unit}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Sale Price:</span>
                      <span className="detail-value">{formatCurrency(product.sale_price)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Purchase Price:</span>
                      <span className="detail-value">{formatCurrency(product.purchase_price)}</span>
                    </div>
                  </div>
                  {canEdit() && (
                    <button 
                      className="quick-add-btn"
                      onClick={() => setStockUpdateForm({ 
                        product_id: product.id, 
                        quantity: 10, 
                        operation: 'add' 
                      })}
                      type="button"
                    >
                      + Add 10 Units
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Stock Alerts */}
      <div className="inventory-section">
        <h3>🔔 Active Stock Alerts</h3>
        {stockAlerts.length === 0 ? (
          <p className="muted-text">No active stock alerts</p>
        ) : (
          <div className="alerts-list">
            {stockAlerts.map((alert) => (
              <div key={alert.id} className="alert-card">
                <div className="alert-info">
                  <div className="alert-main">
                    <span className="alert-product">{alert.products?.name}</span>
                    <span className="alert-type">{alert.alert_type.replace('_', ' ')}</span>
                  </div>
                  <div className="alert-details">
                    <span className="alert-threshold">Threshold: {alert.threshold} units</span>
                    <span className="alert-current">Current: {alert.products?.stock} {alert.products?.unit}</span>
                  </div>
                </div>

                <div className="alert-actions">
                  {canEdit() && (
                    <button 
                      className="action-button resolve-btn"
                      onClick={() => handleResolveAlert(alert.id)}
                      type="button"
                    >
                      Resolve
                    </button>
                  )}
                  {canDelete() && (
                    <button 
                      className="action-button delete-btn"
                      onClick={() => handleDeleteAlert(alert.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Stock Alert</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAlert} className="modal-form">
              <div className="form-label">
                <span>Select Product</span>
                <select 
                  className="form-input"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  required
                >
                  <option value="">Choose a product...</option>
                  {lowStockProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - Current: {product.stock} {product.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-label">
                <span>Alert Type</span>
                <select 
                  className="form-input"
                  value={form.alert_type}
                  onChange={(e) => setForm({ ...form, alert_type: e.target.value })}
                >
                  <option value="low_stock">Low Stock Warning</option>
                  <option value="out_of_stock">Out of Stock Alert</option>
                  <option value="reorder">Reorder Reminder</option>
                </select>
              </div>

              <div className="form-label">
                <span>Stock Threshold</span>
                <input 
                  type="number" 
                  className="form-input"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: parseInt(e.target.value) })}
                  min="1"
                  required
                />
                <span className="form-hint">Alert when stock falls below this number</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryManagement;
