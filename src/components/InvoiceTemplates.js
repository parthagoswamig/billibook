import React, { useState } from 'react';

function InvoiceTemplates() {
  const [templates, setTemplates] = useState([
    {
      id: 1,
      name: 'Default Professional',
      description: 'Clean and professional invoice template',
      primaryColor: '#6366f1',
      secondaryColor: '#06b6d4',
      accentColor: '#f97316',
      logo: null,
      showLogo: true,
      showBarcode: false,
      showQR: false,
      showSignature: false,
      layout: 'standard',
      fontSize: 'medium'
    },
    {
      id: 2,
      name: 'Modern Gradient',
      description: 'Eye-catching gradient design',
      primaryColor: '#8b5cf6',
      secondaryColor: '#ec4899',
      accentColor: '#10b981',
      logo: null,
      showLogo: true,
      showBarcode: true,
      showQR: true,
      showSignature: false,
      layout: 'modern',
      fontSize: 'medium'
    },
    {
      id: 3,
      name: 'Minimalist',
      description: 'Simple and clean design',
      primaryColor: '#374151',
      secondaryColor: '#6b7280',
      accentColor: '#9ca3af',
      logo: null,
      showLogo: false,
      showBarcode: false,
      showQR: false,
      showSignature: true,
      layout: 'minimal',
      fontSize: 'small'
    }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({
    name: 'Custom Template',
    primaryColor: '#6366f1',
    secondaryColor: '#06b6d4',
    accentColor: '#f97316',
    showLogo: true,
    showBarcode: false,
    showQR: false,
    showSignature: false,
    layout: 'standard',
    fontSize: 'medium'
  });

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  const handleSaveCustom = () => {
    const newTemplate = {
      ...customTemplate,
      id: Date.now(),
      description: 'Custom created template'
    };
    setTemplates([...templates, newTemplate]);
    setSelectedTemplate(newTemplate);
    setShowCustomizer(false);
  };

  const renderPreview = (template) => {
    return (
      <div className="template-preview" style={{ 
        '--primary': template.primaryColor,
        '--secondary': template.secondaryColor,
        '--accent': template.accentColor 
      }}>
        <div className="preview-header">
          {template.showLogo && <div className="preview-logo">LOGO</div>}
          <div className="preview-title">INVOICE</div>
        </div>
        <div className="preview-body">
          <div className="preview-info">
            <div className="preview-bill-to">
              <strong>Bill To:</strong>
              <div>Customer Name</div>
              <div>Address Line 1</div>
              <div>City, State ZIP</div>
            </div>
            <div className="preview-invoice-details">
              <div><strong>Invoice #:</strong> INV-001</div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Due Date:</strong> {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="preview-table">
            <div className="preview-table-header">
              <div>Item</div>
              <div>Qty</div>
              <div>Price</div>
              <div>Total</div>
            </div>
            <div className="preview-table-row">
              <div>Product 1</div>
              <div>2</div>
              <div>₹500.00</div>
              <div>₹1,000.00</div>
            </div>
            <div className="preview-table-row">
              <div>Product 2</div>
              <div>1</div>
              <div>₹750.00</div>
              <div>₹750.00</div>
            </div>
          </div>
          <div className="preview-totals">
            <div>Subtotal: ₹1,750.00</div>
            <div>GST (18%): ₹315.00</div>
            <div style={{ fontWeight: 'bold', fontSize: '18px' }}>Total: ₹2,065.00</div>
          </div>
          {template.showSignature && (
            <div className="preview-signature">
              <div>Authorized Signature</div>
              <div className="signature-line"></div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="invoice-templates">
      <div className="templates-header">
        <h2>🎨 Invoice Templates</h2>
        <button 
          className="primary-button" 
          onClick={() => setShowCustomizer(true)}
          type="button"
        >
          + Create Custom
        </button>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <div 
            key={template.id} 
            className={`template-card ${selectedTemplate.id === template.id ? 'selected' : ''}`}
            onClick={() => handleSelectTemplate(template)}
          >
            <div className="template-thumbnail">
              {renderPreview(template)}
            </div>
            <div className="template-info">
              <h4>{template.name}</h4>
              <p>{template.description}</p>
              <div className="template-features">
                {template.showLogo && <span className="feature-tag">Logo</span>}
                {template.showBarcode && <span className="feature-tag">Barcode</span>}
                {template.showQR && <span className="feature-tag">QR</span>}
                {template.showSignature && <span className="feature-tag">Signature</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Template Creator */}
      {showCustomizer && (
        <div className="modal-overlay" onClick={() => setShowCustomizer(false)}>
          <div className="modal-content template-customizer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Custom Template</h3>
              <button className="modal-close" onClick={() => setShowCustomizer(false)}>✕</button>
            </div>
            <div className="customizer-form">
              <div className="form-label">
                <span>Template Name</span>
                <input 
                  className="form-input"
                  value={customTemplate.name}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, name: e.target.value })}
                />
              </div>

              <div className="color-picker-section">
                <h4>Colors</h4>
                <div className="color-grid">
                  <div className="color-picker">
                    <label>Primary</label>
                    <input 
                      type="color" 
                      value={customTemplate.primaryColor}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, primaryColor: e.target.value })}
                    />
                  </div>
                  <div className="color-picker">
                    <label>Secondary</label>
                    <input 
                      type="color" 
                      value={customTemplate.secondaryColor}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, secondaryColor: e.target.value })}
                    />
                  </div>
                  <div className="color-picker">
                    <label>Accent</label>
                    <input 
                      type="color" 
                      value={customTemplate.accentColor}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, accentColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="features-section">
                <h4>Features</h4>
                <div className="checkbox-group">
                  <label>
                    <input 
                      type="checkbox"
                      checked={customTemplate.showLogo}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, showLogo: e.target.checked })}
                    />
                    Show Logo
                  </label>
                  <label>
                    <input 
                      type="checkbox"
                      checked={customTemplate.showBarcode}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, showBarcode: e.target.checked })}
                    />
                    Show Barcode
                  </label>
                  <label>
                    <input 
                      type="checkbox"
                      checked={customTemplate.showQR}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, showQR: e.target.checked })}
                    />
                    Show QR Code
                  </label>
                  <label>
                    <input 
                      type="checkbox"
                      checked={customTemplate.showSignature}
                      onChange={(e) => setCustomTemplate({ ...customTemplate, showSignature: e.target.checked })}
                    />
                    Show Signature
                  </label>
                </div>
              </div>

              <div className="form-label">
                <span>Layout Style</span>
                <select 
                  className="form-input"
                  value={customTemplate.layout}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, layout: e.target.value })}
                >
                  <option value="standard">Standard</option>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>

              <div className="form-label">
                <span>Font Size</span>
                <select 
                  className="form-input"
                  value={customTemplate.fontSize}
                  onChange={(e) => setCustomTemplate({ ...customTemplate, fontSize: e.target.value })}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div className="template-preview-section">
                <h4>Preview</h4>
                {renderPreview(customTemplate)}
              </div>

              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowCustomizer(false)}>Cancel</button>
                <button className="primary-button" onClick={handleSaveCustom}>Save Template</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceTemplates;
