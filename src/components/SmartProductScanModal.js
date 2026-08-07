import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import { bulkImportProducts, invalidateDashboardCache } from '../lib/db';
import toast from 'react-hot-toast';

export default function SmartProductScanModal({ isOpen, onClose, tenantId, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [extractedItems, setExtractedItems] = useState([]);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setExtractedItems([]);

    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const parseTextToProducts = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const items = [];

    // Header words to ignore
    const ignoreWords = ['tax', 'invoice', 'subtotal', 'total', 'grand', 'gstin', 'phone', 'address', 'date', 'bill', 'sl', 'no', 'sl.', 'serial', 'particulars', 'hsn/sac', 'amount', 'qty', 'rate'];

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      // Skip headers
      if (ignoreWords.some(w => lower.startsWith(w) && lower.length < 25)) return;
      if (lower.includes('tax invoice') || lower.includes('thank you') || lower.includes('authorized signatory')) return;

      // Extract numbers (prices, quantities, HSNs)
      const numbers = line.match(/\d+(\.\d+)?/g) || [];
      if (numbers.length === 0) return;

      // Extract potential product name (text before numbers or main text)
      // Remove pure price or quantity numbers from line to isolate product name
      let productName = line
        .replace(/₹|Rs\.|INR/gi, '')
        .replace(/\b\d{4,8}\b/g, '') // HSN
        .replace(/\b\d+(\.\d+)?\s*(pcs|ltr|kg|can|drum|bucket|box|set|pkt|roll|mtr|gm|ml|btl|nos|bag)\b/gi, '')
        .replace(/\d+(\.\d+)?/g, '') // remaining standalone numbers
        .replace(/[^\w\s\-\.\(\)]/gi, ' ')
        .trim();

      if (productName.length < 2) return;

      // Attempt smart parsing of numbers
      let hsn = '';
      let price = 0;
      let qty = 1;
      let unit = 'Pcs';

      // HSN code detection (4 to 8 digits)
      const hsnMatch = line.match(/\b(\d{4,8})\b/);
      if (hsnMatch) hsn = hsnMatch[1];

      // Unit detection
      const unitMatch = line.match(/\b(pcs|ltr|kg|can|drum|bucket|box|set|pkt|roll|mtr|gm|ml|btl|nos|bag)\b/i);
      if (unitMatch) {
        const u = unitMatch[1].toUpperCase();
        if (u.includes('LTR')) unit = 'Ltr';
        else if (u.includes('KG')) unit = 'Kg';
        else if (u.includes('CAN')) unit = 'Can';
        else if (u.includes('DRUM')) unit = 'Drum';
        else if (u.includes('BKT') || u.includes('BUCKET')) unit = 'Bucket';
        else if (u.includes('BOX')) unit = 'Box';
        else if (u.includes('SET')) unit = 'Set';
        else if (u.includes('PKT')) unit = 'Pkt';
        else if (u.includes('BTL')) unit = 'Btl';
        else unit = 'Pcs';
      }

      // Assign prices and quantities from parsed numbers
      const decimalOrPrice = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));
      if (decimalOrPrice.length >= 2) {
        qty = decimalOrPrice[0] > 0 && decimalOrPrice[0] <= 1000 ? decimalOrPrice[0] : 1;
        price = decimalOrPrice[decimalOrPrice.length - 1]; // last number is usually row total or unit price
      } else if (decimalOrPrice.length === 1) {
        price = decimalOrPrice[0];
      }

      items.push({
        name: productName,
        hsn: hsn,
        sale_price: price || 0,
        purchase_price: price ? Math.round(price * 0.8) : 0,
        stock: qty || 1,
        unit: unit,
        gst: 18
      });
    });

    return items;
  };

  const handleStartScan = async () => {
    if (!file) {
      toast.error('Please select an Image or Document file first!');
      return;
    }

    setScanning(true);
    setProgress(0);
    setStatusText('Reading document text with AI OCR scanner...');

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
            setStatusText(`Extracting text... ${Math.round(m.progress * 100)}%`);
          } else {
            setStatusText(m.status);
          }
        }
      });

      const extractedText = result.data.text;
      const parsedProducts = parseTextToProducts(extractedText);

      if (parsedProducts.length === 0) {
        toast.error('Could not detect product lines clearly. You can add product details manually below or upload a clearer photo.');
        setExtractedItems([{ name: '', hsn: '', sale_price: '', purchase_price: '', stock: 1, unit: 'Pcs', gst: 18 }]);
      } else {
        setExtractedItems(parsedProducts);
        toast.success(`🎉 Found ${parsedProducts.length} product(s) in document!`);
      }
    } catch (err) {
      console.error("OCR Scan Failed:", err);
      toast.error(err.message || 'Scan failed. Please upload a clear JPG/PNG photo.');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (index, field, value) => {
    const updated = [...extractedItems];
    updated[index][field] = value;
    setExtractedItems(updated);
  };

  const removeItem = (index) => {
    setExtractedItems(extractedItems.filter((_, i) => i !== index));
  };

  const addItemRow = () => {
    setExtractedItems([...extractedItems, { name: '', hsn: '', sale_price: '', purchase_price: '', stock: 1, unit: 'Pcs', gst: 18 }]);
  };

  const handleImportToDatabase = async () => {
    const validItems = extractedItems.filter(i => i.name && i.name.trim().length > 0);
    if (validItems.length === 0) {
      toast.error('No valid products to import!');
      return;
    }

    setImporting(true);
    try {
      await bulkImportProducts(tenantId, validItems);
      invalidateDashboardCache(tenantId);
      toast.success(`✓ Successfully imported ${validItems.length} product(s) to catalog!`);
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      console.error("Bulk Import Failed:", err);
      toast.error(err.message || 'Failed to save products.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>📷 AI Document & Photo Scanner (Auto Product Importer)</h3>
          <button className="close-button" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Upload a photo or scanned copy of a <strong>Product Price List, Supplier Bill, Catalog, or Inventory Paper</strong>. Our AI OCR engine will extract all products, prices, stock, and HSN codes automatically!
          </p>

          {/* Upload Area */}
          <div style={{
            border: '2px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            background: '#F8FAFC',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={handleFileChange} 
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer'
              }} 
            />
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
            <div style={{ fontWeight: '600', color: '#1E293B' }}>
              {file ? `Selected File: ${file.name}` : 'Click or Drag & Drop Photo / PDF Document here'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Supports JPG, PNG, WEBP, PDF price lists and bill photos
            </div>
          </div>

          {previewUrl && (
            <div style={{ textAlign: 'center', maxHeight: '180px', overflow: 'hidden', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: '180px', objectFit: 'contain' }} />
            </div>
          )}

          {/* Action Button */}
          {file && (
            <button 
              type="button" 
              className="primary-button" 
              onClick={handleStartScan} 
              disabled={scanning}
              style={{ background: '#4F46E5', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '600' }}
            >
              {scanning ? `⌛ ${statusText}` : '⚡ Start AI Scanner & Extract Products'}
            </button>
          )}

          {scanning && (
            <div style={{ width: '100%', background: '#E2E8F0', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, background: '#4F46E5', height: '100%', transition: 'width 0.3s' }} />
            </div>
          )}

          {/* Extracted Product List Preview Table */}
          {extractedItems.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1E293B' }}>
                  Extracted Products ({extractedItems.length}) — Review & Edit
                </h4>
                <button type="button" className="secondary-button" onClick={addItemRow}>
                  + Add Row
                </button>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <table className="spreadsheet-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', fontSize: '12px', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>#</th>
                      <th style={{ padding: '8px', width: '30%' }}>Product Name</th>
                      <th style={{ padding: '8px', width: '15%' }}>HSN</th>
                      <th style={{ padding: '8px', width: '15%' }}>Sale Price (₹)</th>
                      <th style={{ padding: '8px', width: '15%' }}>Stock Qty</th>
                      <th style={{ padding: '8px', width: '15%' }}>Unit</th>
                      <th style={{ padding: '8px', width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '6px 8px', fontSize: '12px' }}>{idx + 1}</td>
                        <td style={{ padding: '4px' }}>
                          <input 
                            className="spreadsheet-input" 
                            value={item.name} 
                            onChange={(e) => updateItem(idx, 'name', e.target.value)} 
                            placeholder="Product Name" 
                          />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input 
                            className="spreadsheet-input" 
                            value={item.hsn} 
                            onChange={(e) => updateItem(idx, 'hsn', e.target.value)} 
                            placeholder="HSN" 
                          />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input 
                            className="spreadsheet-input" 
                            type="number" 
                            value={item.sale_price} 
                            onChange={(e) => updateItem(idx, 'sale_price', e.target.value)} 
                            placeholder="Price" 
                          />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input 
                            className="spreadsheet-input" 
                            type="number" 
                            value={item.stock} 
                            onChange={(e) => updateItem(idx, 'stock', e.target.value)} 
                            placeholder="Stock" 
                          />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input 
                            className="spreadsheet-input" 
                            value={item.unit} 
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)} 
                            placeholder="Unit" 
                          />
                        </td>
                        <td style={{ padding: '4px', textAlign: 'center' }}>
                          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }} onClick={() => removeItem(idx)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          {extractedItems.length > 0 && (
            <button 
              type="button" 
              className="primary-button" 
              onClick={handleImportToDatabase} 
              disabled={importing}
              style={{ background: '#10B981', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: '600' }}
            >
              {importing ? 'Saving Products...' : `✓ Save All ${extractedItems.length} Products to Catalog`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
