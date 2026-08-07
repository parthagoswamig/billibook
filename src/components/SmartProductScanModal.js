import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { bulkImportProducts, getProductCategories, invalidateDashboardCache } from '../lib/db';
import toast from 'react-hot-toast';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function SmartProductScanModal({ isOpen, onClose, tenantId, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [extractedItems, setExtractedItems] = useState([]);
  const [importing, setImporting] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (tenantId && isOpen) {
      getProductCategories(tenantId)
        .then(cats => setCategories(cats || []))
        .catch(err => console.error("Failed to load categories:", err));
    }
  }, [tenantId, isOpen]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!isOpen) return null;

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      toast.error('Unable to access camera. Please upload a photo or PDF.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `camera_scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFile(capturedFile);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setExtractedItems([]);
        stopCamera();
        toast.success('📸 Photo captured successfully!');
      }
    }, 'image/jpeg', 0.95);
  };

  const downloadSampleTemplate = () => {
    const csvContent = "Name,HSN,SalePrice,PurchasePrice,Stock,Unit,GST\nDulux Velvet Touch Premium 1L,3208,480,390,50,Ltr,18\nAsian Paints Royale Emulsion 4L,3209,1450,1180,25,Can,18\nPaint Roller Brush 4 inch,9603,120,85,100,Pcs,12\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Product_Import_Sample_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('📥 Sample Excel template downloaded!');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    stopCamera();
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

    lines.forEach((line) => {
      const lower = line.toLowerCase();

      // Skip document header/footer boilerplate lines
      if (lower.startsWith('official price list') || lower.startsWith('* all prices') || lower.startsWith('file:///') || lower.includes('maa tara paints')) return;
      if (lower.startsWith('item name') || lower.includes('emulsion paints & enamel') || lower.includes('putty, primer & hardware')) return;
      if (lower.includes('page') || lower.includes('total') || lower.includes('subtotal') || lower.includes('thank you')) return;

      const numbers = line.match(/\d+(\.\d+)?/g);
      if (!numbers || numbers.length === 0) return;

      // Extract HSN (4 to 8 digit number)
      let hsn = '';
      const hsnMatch = line.match(/\b(\d{4,8})\b/);
      if (hsnMatch) {
        hsn = hsnMatch[1];
      }

      // Extract Unit
      let unit = 'Pcs';
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

      // Extract Price (last numeric token with optional decimals, e.g. 240.00 or 1850.00)
      const priceMatch = line.match(/₹?\s*(\d+(\.\d+)?)\s*$/) || line.match(/(\d+(\.\d+)?)\s*$/);
      let price = 0;
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      } else {
        const parsedNums = numbers.map(n => parseFloat(n));
        price = parsedNums[parsedNums.length - 1] || 0;
      }

      // Isolate Product Name
      let namePart = line
        .replace(/₹|Rs\.|INR/gi, '')
        .replace(/\b\d+(\.\d+)?\s*$/, '') // remove price at end
        .replace(/\b\d{4,8}\b/g, '') // remove HSN
        .replace(/\b(pcs|ltr|kg|can|drum|bucket|box|set|pkt|roll|mtr|gm|ml|btl|nos|bag)\b/gi, '') // remove unit
        .replace(/[^\w\s\-\.\(\)]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (namePart.length < 2) {
        const firstNumIdx = line.search(/\d/);
        if (firstNumIdx > 2) {
          namePart = line.substring(0, firstNumIdx).trim();
        } else {
          namePart = line.trim();
        }
      }

      if (namePart.length >= 2 && price > 0) {
        items.push({
          name: namePart,
          hsn: hsn,
          sale_price: price,
          purchase_price: Math.round(price * 0.8),
          stock: 10,
          unit: unit,
          gst: 18,
          category_id: selectedCatId || null
        });
      }
    });

    return items;
  };

  const handleStartScan = async () => {
    if (!file) {
      toast.error('Please select an Image, PDF or capture a photo first!');
      return;
    }

    setScanning(true);
    setProgress(10);
    setStatusText('Analyzing document with AI Scanner Engine...');

    try {
      let extractedText = '';

      // Check if file is a PDF
      if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        setStatusText('Reading PDF document text...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let pdfTextLines = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          pdfTextLines.push(pageText);
        }
        extractedText = pdfTextLines.join('\n');
        setProgress(100);
      } else {
        // Image OCR with Tesseract
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
        extractedText = result.data.text;
      }

      const parsedProducts = parseTextToProducts(extractedText);

      if (parsedProducts.length === 0) {
        toast.error('Could not detect clear product lines automatically. You can add items manually in the table below.');
        setExtractedItems([{ name: '', hsn: '', sale_price: '', purchase_price: '', stock: 10, unit: 'Pcs', gst: 18, category_id: selectedCatId || null }]);
      } else {
        setExtractedItems(parsedProducts);
        toast.success(`🎉 Found ${parsedProducts.length} product(s) in document!`);
      }
    } catch (err) {
      console.error("Scanner Processing Failed:", err);
      toast.error(err.message || 'Processing failed. Please check the file.');
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
    setExtractedItems([...extractedItems, { name: '', hsn: '', sale_price: '', purchase_price: '', stock: 10, unit: 'Pcs', gst: 18, category_id: selectedCatId || null }]);
  };

  const handleImportToDatabase = async () => {
    const validItems = extractedItems
      .filter(i => i.name && i.name.trim().length > 0)
      .map(i => ({
        ...i,
        category_id: i.category_id || selectedCatId || null
      }));

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
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>📷 AI Document & Photo Scanner (Smart Auto Product Importer)</h3>
          <button className="close-button" type="button" onClick={() => { stopCamera(); onClose(); }}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Upload a photo/PDF or <strong>Snap a Live Picture</strong> of a <strong>Product Price List, Supplier Bill, Catalog, or Inventory Paper</strong>. Our AI engine will extract all products, prices, stock, and HSN codes automatically!
          </p>

          {/* Action Row: Category Tagging & Sample CSV Template */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: '#F1F5F9', padding: '10px 14px', borderRadius: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
              <span>Default Category:</span>
              <select 
                value={selectedCatId} 
                onChange={(e) => setSelectedCatId(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff', fontSize: '13px' }}
              >
                <option value="">No Category / Global</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <button 
              type="button" 
              className="secondary-button" 
              onClick={downloadSampleTemplate}
              style={{ marginLeft: 'auto', background: '#fff', border: '1px solid #CBD5E1', fontSize: '12px' }}
            >
              📥 Download Sample Excel Template
            </button>
          </div>

          {/* Camera Viewfinder or File Dropzone */}
          {cameraActive ? (
            <div style={{ textAlign: 'center', background: '#0F172A', borderRadius: '12px', padding: '16px', position: 'relative' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '280px', borderRadius: '8px', objectFit: 'contain' }} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="primary-button" onClick={capturePhoto} style={{ background: '#10B981', color: '#fff', padding: '10px 20px', fontWeight: '600' }}>
                  📸 Snap Photo & Scan
                </button>
                <button type="button" className="secondary-button" onClick={stopCamera} style={{ background: '#334155', color: '#fff', border: 'none' }}>
                  Cancel Camera
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                flex: '1 1 280px',
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
                  {file ? `Selected: ${file.name}` : 'Click or Drag & Drop Photo / PDF Document'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  Supports JPG, PNG, WEBP, PDF bill photos & price lists
                </div>
              </div>

              <div 
                onClick={startCamera}
                style={{
                  flex: '0 0 160px',
                  border: '2px solid #C7D2FE',
                  borderRadius: '12px',
                  padding: '24px 12px',
                  textAlign: 'center',
                  background: '#EEF2FF',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <div style={{ fontSize: '28px' }}>📸</div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#4F46E5' }}>
                  Live Camera Snap
                </div>
                <div style={{ fontSize: '11px', color: '#6366F1' }}>
                  Take photo with camera
                </div>
              </div>
            </div>
          )}

          {previewUrl && !cameraActive && (
            <div style={{ textAlign: 'center', maxHeight: '180px', overflow: 'hidden', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: '180px', objectFit: 'contain' }} />
            </div>
          )}

          {/* Action Button */}
          {file && !cameraActive && (
            <button 
              type="button" 
              className="primary-button" 
              onClick={handleStartScan} 
              disabled={scanning}
              style={{ background: '#4F46E5', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}
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
                      <th style={{ padding: '8px', width: '28%' }}>Product Name</th>
                      <th style={{ padding: '8px', width: '12%' }}>HSN</th>
                      <th style={{ padding: '8px', width: '15%' }}>Sale Price (₹)</th>
                      <th style={{ padding: '8px', width: '15%' }}>Cost Price (₹)</th>
                      <th style={{ padding: '8px', width: '12%' }}>Stock Qty</th>
                      <th style={{ padding: '8px', width: '12%' }}>Unit</th>
                      <th style={{ padding: '8px', width: '6%' }}></th>
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
                            value={item.purchase_price} 
                            onChange={(e) => updateItem(idx, 'purchase_price', e.target.value)} 
                            placeholder="Cost" 
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
          <button type="button" className="secondary-button" onClick={() => { stopCamera(); onClose(); }}>
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
