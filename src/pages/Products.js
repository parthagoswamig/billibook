import React, { useEffect, useState } from 'react';
import PageSection from '../components/PageSection';
import SimpleTable from '../components/SimpleTable';
import Pagination from '../components/Pagination';
import { useUser } from '../lib/useUser';
import { 
  getProducts, 
  addProduct, 
  updateProduct, 
  deleteProduct, 
  bulkImportProducts,
  getProductCategories,
  createProductCategory,
  deleteProductCategory
} from '../lib/db';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { formatCurrency, exportToCSV, importFromCSV } from '../lib/utils';
import BarcodeQRGenerator from '../components/BarcodeQRGenerator';

const STANDARD_UQCS = [
  { code: 'PCS', label: 'PCS - PIECES' },
  { code: 'NOS', label: 'NOS - NUMBERS' },
  { code: 'BOX', label: 'BOX - BOX' },
  { code: 'KGS', label: 'KGS - KILOGRAMS' },
  { code: 'LTR', label: 'LTR - LITRES' },
  { code: 'MTR', label: 'MTR - METRES' }
];

const GST_SLABS = [0, 5, 12, 18, 28];

function Products() {
  const { userId, loading: userLoading } = useUser();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useBusiness();
  const { canCreate, canEdit, canDelete, tenantId } = useRole();
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ 
    name: '', hsn: '', gst: 18, stock: 0, sale_price: '', purchase_price: '', 
    unit: 'PCS', mrp: '', min_stock: '', track_stock: true, is_service: false, 
    description: '', sku: '', barcode: '', category_id: '' 
  });
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [generatorType, setGeneratorType] = useState('qr');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  useEffect(() => {
    const loadCategories = async () => {
      if (!tenantId) return;
      try {
        const cats = await getProductCategories(tenantId);
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    loadCategories();
  }, [tenantId]);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const prods = await getProducts(tenantId, page, limit, search, selectedCategory);
      setProducts(prods);
      setTotalCount(prods.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, page, search, selectedCategory]);

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const newCat = await createProductCategory(tenantId, newCatName.trim());
      setCategories(prev => [...prev, newCat]);
      setForm(prev => ({ ...prev, category_id: newCat.id }));
      setNewCatName('');
      setShowNewCatInput(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !form.name) return;
    if (editId && !canEdit()) return;
    if (!editId && !canCreate()) return;
    try {
      const payload = {
        name: form.name, 
        hsn: form.hsn, 
        gst: parseInt(form.gst, 10) || 0,
        stock: parseFloat(form.stock) || 0, 
        sale_price: parseFloat(form.sale_price) || 0,
        purchase_price: parseFloat(form.purchase_price) || 0, 
        unit: form.unit,
        mrp: parseFloat(form.mrp) || 0, 
        min_stock: parseFloat(form.min_stock) || 0,
        track_stock: !!form.track_stock, 
        is_service: !!form.is_service,
        description: form.description || '',
        sku: form.sku || '',
        barcode: form.barcode || '',
        category_id: form.category_id || null
      };

      if (editId) {
        await updateProduct(editId, payload);
      } else {
        await addProduct(tenantId, payload);
      }
      setShowModal(false);
      setForm({ 
        name: '', hsn: '', gst: 18, stock: 0, sale_price: '', purchase_price: '', 
        unit: 'PCS', mrp: '', min_stock: '', track_stock: true, is_service: false, 
        description: '', sku: '', barcode: '', category_id: '' 
      });
      setMessage('✓ Product saved');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteProduct(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = () => {
    exportToCSV(
      'products.csv',
      ['Name', 'HSN', 'GST%', 'Stock', 'Unit', 'Sale Price', 'Purchase Price', 'SKU', 'Barcode'],
      products.map((p) => [p.name, p.hsn || '', p.gst, p.stock, p.unit, p.sale_price, p.purchase_price, p.sku || '', p.barcode || '']),
    );
  };

  const handleImport = async () => {
    if (!canCreate() || !tenantId) return;
    try {
      const data = await importFromCSV();
      if (!data || data.length === 0) {
        setError('No data found in CSV file');
        return;
      }
      await bulkImportProducts(tenantId, data);
      setMessage(`✓ Imported ${data.length} products`);
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setError(err.message || 'Failed to import products');
    }
  };

  const filteredProducts = products;

  return (
    <>
      <PageSection
        eyebrow="Stock"
        title="Products & Inventory"
        description="Manage products, stock levels, HSN codes, and GST rates."
        actions={
          <>
            {canCreate() && <button className="secondary-button" type="button" onClick={handleImport}>📤 Import CSV</button>}
            <button className="secondary-button" type="button" onClick={handleExport}>📥 Export CSV</button>
            {canCreate() && (
              <button 
                className="primary-button" 
                type="button" 
                onClick={() => { 
                  setEditId(null); 
                  setForm({ 
                    name: '', hsn: '', gst: 18, stock: 0, sale_price: '', purchase_price: '', 
                    unit: 'PCS', mrp: '', min_stock: '', track_stock: true, is_service: false, 
                    description: '', sku: '', barcode: '', category_id: '' 
                  }); 
                  setShowNewCatInput(false);
                  setShowModal(true); 
                  setError(''); 
                }}
              >
                + Add product
              </button>
            )}
          </>
        }
      >
        {message && <p className="form-message form-success">{message}</p>}
        {error && <p className="form-message form-error">{error}</p>}

        {loading || userLoading ? (
          <div className="empty-state">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">No products found. Add your first product.</div>
        ) : (
          <>
            {/* Filters Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '24px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 Search by Name, SKU or Barcode..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '400px', width: '100%' }}
              />
              
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #E8ECFF',
                    background: selectedCategory === '' ? 'var(--accent)' : 'white',
                    color: selectedCategory === '' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: '1px solid #E8ECFF',
                      background: selectedCategory === cat.id ? 'var(--accent)' : 'white',
                      color: selectedCategory === cat.id ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="empty-state">No products match your search or category filter.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {filteredProducts.map((p) => {
                    const isLowStock = !p.is_service && parseFloat(p.stock) <= 5;
                    const maxStockDisplay = Math.max(20, parseFloat(p.stock) + 10);
                    const percentage = Math.min(100, (parseFloat(p.stock) / maxStockDisplay) * 100);
                    
                    return (
                      <div 
                        key={p.id} 
                        style={{
                          background: 'white',
                          borderRadius: '14px',
                          padding: '18px',
                          border: '1px solid #E8ECFF',
                          position: 'relative',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                      >
                        <div>
                          {/* GST badge top right */}
                          <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'var(--accent-light)',
                            color: 'var(--accent-dark)',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            {p.gst || 0}% GST
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{p.name}</span>
                            {p.product_categories?.name && (
                              <span style={{
                                background: 'var(--accent-light)',
                                color: 'var(--accent-dark)',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '20px'
                              }}>
                                {p.product_categories.name}
                              </span>
                            )}
                            {p.hsn && (
                              <span style={{
                                background: 'var(--accent-light)',
                                color: 'var(--accent)',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '20px'
                              }}>
                                HSN: {p.hsn}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', marginBottom: '8px' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Sale: </span>
                              <span style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(p.sale_price, currency)}</span>
                            </div>
                            {p.purchase_price > 0 && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Purchase: </span>
                                <span style={{ fontWeight: '700', color: 'var(--warning)' }}>{formatCurrency(p.purchase_price, currency)}</span>
                              </div>
                            )}
                          </div>

                          {/* Display SKU & Barcode in details */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                            {p.sku && <span><strong>SKU:</strong> {p.sku}</span>}
                            {p.barcode && <span><strong>Barcode:</strong> {p.barcode}</span>}
                          </div>
                        </div>

                        <div>
                          {/* Stock level progress-bar */}
                          {!p.is_service && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: isLowStock ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: '4px' }}>
                                <span>Stock Level</span>
                                <span>{p.stock} {p.unit || 'Pcs'}</span>
                              </div>
                              <div style={{ background: '#F1F5F9', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                  background: isLowStock ? 'var(--danger)' : 'var(--accent)',
                                  width: `${percentage}%`,
                                  height: '100%'
                                }} />
                              </div>
                            </div>
                          )}
                          {p.is_service && (
                            <div style={{ marginBottom: '12px', fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              Service item (Non-physical)
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px' }} type="button" onClick={() => { setSelectedProduct(p); setGeneratorType('qr'); setShowBarcodeModal(true); }}>📱 QR</button>
                            <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px' }} type="button" onClick={() => { setSelectedProduct(p); setGeneratorType('barcode'); setShowBarcodeModal(true); }}>📊 Barcode</button>
                            {canEdit() && (
                              <button 
                                className="action-button" 
                                style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)' }} 
                                type="button" 
                                onClick={() => {
                                  setEditId(p.id);
                                  setForm({ 
                                    name: p.name, hsn: p.hsn || '', gst: p.gst || 18, stock: p.stock, 
                                    sale_price: p.sale_price, purchase_price: p.purchase_price || '', unit: p.unit || 'PCS',
                                    mrp: p.mrp || '', min_stock: p.min_stock || '', track_stock: p.track_stock ?? true,
                                    is_service: p.is_service ?? false, description: p.description || '',
                                    sku: p.sku || '', barcode: p.barcode || '', category_id: p.category_id || ''
                                  });
                                  setShowNewCatInput(false);
                                  setShowModal(true);
                                }}
                              >
                                Edit
                              </button>
                            )}
                            {canDelete() && (
                              <button 
                                className="action-button danger-btn" 
                                style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--danger-light)', color: 'var(--danger)', marginLeft: 'auto' }} 
                                type="button" 
                                onClick={() => handleDelete(p.id, p.name)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '24px' }}>
                  <Pagination 
                    page={page} 
                    limit={limit} 
                    totalCount={totalCount} 
                    onChangePage={(p) => setPage(p)} 
                  />
                </div>
              </>
            )}
          </>
        )}
  </PageSection>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit' : 'Add'} Product</h3>
              <button className="modal-close" type="button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <label className="form-label"><span>Product Name *</span>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Category</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select 
                      className="form-input" 
                      value={form.category_id || ''} 
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      style={{ flex: 1, height: '40px' }}
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="secondary-button" 
                      style={{ padding: '8px 12px', whiteSpace: 'nowrap', height: '40px' }} 
                      onClick={() => setShowNewCatInput(!showNewCatInput)}
                    >
                      + New
                    </button>
                  </div>
                </label>
              </div>

              {showNewCatInput && (
                <div style={{
                  background: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center'
                }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="New category name..." 
                    value={newCatName} 
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <button 
                    type="button" 
                    className="primary-button" 
                    onClick={handleSaveCategory}
                    style={{ padding: '8px 16px', height: '40px' }}
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    className="secondary-button" 
                    onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                    style={{ padding: '8px 16px', height: '40px' }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="form-row">
                <label className="form-label"><span>SKU</span>
                  <input 
                    className="form-input" 
                    value={form.sku} 
                    onChange={(e) => setForm({ ...form, sku: e.target.value })} 
                    placeholder="Auto-generated if blank"
                  />
                </label>
                <label className="form-label"><span>Barcode</span>
                  <input 
                    className="form-input" 
                    value={form.barcode} 
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })} 
                    placeholder="Scan or enter barcode"
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-label"><span>HSN Code</span>
                  <input className="form-input" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
                </label>
                <label className="form-label"><span>GST %</span>
                  <select 
                    className="form-input" 
                    value={form.gst} 
                    onChange={(e) => setForm({ ...form, gst: parseInt(e.target.value, 10) })}
                  >
                    {GST_SLABS.map(slab => (
                      <option key={slab} value={slab}>{slab}%</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                {!form.is_service && (
                  <label className="form-label"><span>Opening Stock *</span>
                    <input type="number" className="form-input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
                  </label>
                )}
                <label className="form-label" style={{ gridColumn: form.is_service ? '1 / -1' : 'auto' }}><span>Unit (UQC)</span>
                  <select 
                    className="form-input" 
                    value={form.unit} 
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    {STANDARD_UQCS.map(u => (
                      <option key={u.code} value={u.code}>{u.label}</option>
                    ))}
                    {form.unit && !STANDARD_UQCS.some(u => u.code === form.unit) && (
                      <option value={form.unit}>{form.unit}</option>
                    )}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label className="form-label" style={{ gridColumn: form.is_service ? '1 / -1' : 'auto' }}><span>Sale Price *</span>
                  <input type="number" className="form-input" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} step="0.01" required />
                </label>
                {!form.is_service && (
                  <label className="form-label"><span>Purchase Price</span>
                    <input type="number" className="form-input" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} step="0.01" />
                  </label>
                )}
              </div>

              <div className="form-row">
                <label className="form-label" style={{ gridColumn: form.is_service ? '1 / -1' : 'auto' }}><span>MRP</span>
                  <input type="number" className="form-input" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} step="0.01" />
                </label>
                {!form.is_service && (
                  <label className="form-label"><span>Min Stock Alert</span>
                    <input type="number" className="form-input" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
                  </label>
                )}
              </div>

              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {!form.is_service && (
                  <label className="form-label" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.track_stock} onChange={(e) => setForm({ ...form, track_stock: e.target.checked })} />
                    <span>Track Inventory</span>
                  </label>
                )}
                <label className="form-label" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', gridColumn: form.is_service ? '1 / -1' : 'auto' }}>
                  <input 
                    type="checkbox" 
                    checked={form.is_service} 
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm(prev => ({
                        ...prev,
                        is_service: checked,
                        ...(checked ? { stock: 0, track_stock: false, purchase_price: '' } : {})
                      }));
                    }} 
                  />
                  <span>Is Service / Non-physical</span>
                </label>
              </div>

              <label className="form-label"><span>Description / Remarks</span>
                <textarea className="form-input" rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Enter item details..." />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBarcodeModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowBarcodeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{generatorType === 'qr' ? '📱 QR Code' : '📊 Barcode'} - {selectedProduct.name}</h3>
              <button className="modal-close" type="button" onClick={() => setShowBarcodeModal(false)}>✕</button>
            </div>
            <BarcodeQRGenerator 
              type={generatorType}
              data={selectedProduct.barcode || selectedProduct.sku}
              label={selectedProduct.name}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default Products;
