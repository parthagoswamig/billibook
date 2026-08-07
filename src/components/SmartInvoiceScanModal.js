import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { addParty, invalidateDashboardCache } from '../lib/db';
import toast from 'react-hot-toast';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function SmartInvoiceScanModal({ isOpen, onClose, tenantId, parties, onScanComplete, documentKind = 'sale_invoice' }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
        const capturedFile = new File([blob], `bill_scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFile(capturedFile);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        stopCamera();
        toast.success('📸 Bill photo captured!');
      }
    }, 'image/jpeg', 0.95);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    stopCamera();
    setFile(selectedFile);

    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Smart Parser for Customer + Invoice Line Items
  const parseBillDocument = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let customerName = '';
    let customerPhone = '';
    let customerGstin = '';
    let customerAddress = '';
    let invoiceNo = '';
    let invoiceDate = '';
    const items = [];

    // 1. Extract Customer Info & Document Metadata
    lines.forEach((line) => {
      const lower = line.toLowerCase();

      // Customer Name Detection
      if (!customerName) {
        if (lower.includes('customer name') || lower.includes('customer') || lower.includes('bill to') || lower.includes('party name') || lower.includes('party:')) {
          const cleaned = line.replace(/customer name|customer|bill to|party name|party|name|to:/gi, '').replace(/[:\-]/g, '').trim();
          if (cleaned.length > 2) customerName = cleaned;
        }
      }

      // Phone Number Detection
      if (!customerPhone) {
        const phoneMatch = line.match(/\b([6-9]\d{9})\b/);
        if (phoneMatch) {
          customerPhone = phoneMatch[1];
        }
      }

      // GSTIN Detection
      if (!customerGstin) {
        const gstinMatch = line.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
        if (gstinMatch) {
          customerGstin = gstinMatch[1].toUpperCase();
        }
      }

      // Invoice Number Detection
      if (!invoiceNo) {
        if (lower.includes('invoice no') || lower.includes('bill no') || lower.includes('inv no')) {
          const invMatch = line.match(/(inv|bill|no)[\:\s\-]*([a-z0-9\-]+)/i);
          if (invMatch) invoiceNo = invMatch[2];
        }
      }

      // Date Detection
      if (!invoiceDate) {
        const dateMatch = line.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
        if (dateMatch) {
          invoiceDate = dateMatch[1];
        }
      }
    });

    // Fallback Customer Name if not found with prefix
    if (!customerName) {
      for (const line of lines.slice(0, 10)) {
        const lower = line.toLowerCase();
        if (lower.includes('paints') || lower.includes('hardware') || lower.includes('tax invoice') || lower.includes('cash memo') || lower.includes('retail') || lower.includes('bill pad') || lower.includes('enterprise')) continue;
        if (line.match(/[a-zA-Z]/) && line.length > 3 && !line.match(/\d{5,}/)) {
          customerName = line.trim();
          break;
        }
      }
    }

    // 2. Extract Line Items (Strict Header/Footer Metadata Exclude Filter)
    lines.forEach((line) => {
      const lower = line.toLowerCase();

      // STRICT METADATA EXCLUSION FILTER
      const isMetadataLine = (
        lower.includes('bill no') || lower.includes('invoice no') || lower.includes('inv no') || lower.includes('inv-') ||
        lower.includes('date') || lower.includes('phone') || lower.includes('mobile') ||
        lower.includes('gstin') || lower.includes('customer') || lower.includes('bill to') ||
        lower.includes('party') || lower.includes('grand total') || lower.includes('subtotal') || lower.includes('total') ||
        lower.includes('total amount') || lower.includes('cash memo') || lower.includes('bill pad') ||
        lower.includes('sample paper') || lower.includes('retail cash memo') || lower.includes('thank you') ||
        lower.includes('rates subject') || lower.includes('visit again') || lower.startsWith('sl') ||
        lower.startsWith('item description') || lower.startsWith('particulars') || lower.startsWith('qty') ||
        lower.includes('page') || lower.includes('file:///')
      );

      if (isMetadataLine) return;

      const numbers = line.match(/\d+(\.\d+)?/g);
      if (!numbers || numbers.length === 0) return;

      // Extract HSN
      let hsn = '';
      const hsnMatch = line.match(/\b(\d{4,8})\b/);
      if (hsnMatch) hsn = hsnMatch[1];

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

      // Extract Qty and Price accurately
      const parsedNums = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));
      const price = parsedNums[parsedNums.length - 1]; // Price is the last number

      let qty = 1;
      if (parsedNums.length >= 2) {
        const candidateQty = parsedNums[parsedNums.length - 2]; // Qty is integer before price
        if (Number.isInteger(candidateQty) && candidateQty > 0 && candidateQty <= 500) {
          qty = candidateQty;
        }
      }

      // Sanity Check: Price must be between 1 and 500,000
      if (price <= 0 || price > 500000) return;

      // Isolate Product Name & remove price/qty from end of name
      let namePart = line
        .replace(/₹|Rs\.|INR/gi, '')
        .replace(/\b\d+(\.\d+)?\s*$/, '') // remove price at end
        .trim();

      if (parsedNums.length >= 2) {
        namePart = namePart.replace(/\b\d+\s*$/, '').trim(); // remove qty at end
      }

      namePart = namePart
        .replace(/\b\d{4,8}\b/g, '')
        .replace(/\b(pcs|ltr|kg|can|drum|bucket|box|set|pkt|roll|mtr|gm|ml|btl|nos|bag)\b/gi, '')
        .replace(/[^\w\s\-\.\(\)]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (namePart.length >= 2 && price > 0) {
        items.push({
          name: namePart,
          hsn: hsn,
          qty: qty,
          unit: unit,
          price: price,
          discount: 0,
          gst: 18
        });
      }
    });

    return {
      customerName,
      customerPhone,
      customerGstin,
      customerAddress,
      invoiceNo,
      invoiceDate,
      items
    };
  };

  const handleStartScan = async () => {
    if (!file) {
      toast.error('Please select an Image, PDF or capture a photo first!');
      return;
    }

    setScanning(true);
    setProgress(15);
    setStatusText('🔍 Scanning Paper Bill & Extracting Customer + Items...');

    try {
      let extractedText = '';

      if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let pdfTextLines = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          setProgress(Math.round((i / pdf.numPages) * 50));
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          let lastY = null;
          let pageLines = [];
          let currentLine = '';

          for (const item of textContent.items) {
            const y = item.transform ? Math.round(item.transform[5]) : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
              if (currentLine.trim()) pageLines.push(currentLine.trim());
              currentLine = item.str;
            } else {
              currentLine += (currentLine ? ' ' : '') + item.str;
            }
            if (y !== null) lastY = y;
          }
          if (currentLine.trim()) pageLines.push(currentLine.trim());
          let pageText = pageLines.join('\n');

          if (!pageText || pageText.trim().length < 10) {
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const ocrResult = await Tesseract.recognize(canvas, 'eng');
            pageText = ocrResult.data.text;
          }

          pdfTextLines.push(pageText);
        }
        extractedText = pdfTextLines.join('\n');
      } else {
        const result = await Tesseract.recognize(file, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 80));
            }
          }
        });
        extractedText = result.data.text;
      }

      setProgress(95);
      const parsedData = parseBillDocument(extractedText);
      setProgress(100);

      // Auto Customer Lookup / Creation
      let targetCustomerId = '';
      if (parsedData.customerName) {
        const existingCust = (parties || []).find(p => 
          p.name.toLowerCase().trim() === parsedData.customerName.toLowerCase().trim() ||
          (parsedData.customerPhone && p.phone === parsedData.customerPhone)
        );

        if (existingCust) {
          targetCustomerId = existingCust.id;
          toast.success(`✓ Linked existing party: ${existingCust.name}`);
        } else {
          try {
            const newCust = await addParty(tenantId, {
              name: parsedData.customerName || 'Paper Bill Customer',
              phone: parsedData.customerPhone || '',
              gstin: parsedData.customerGstin || '',
              address: parsedData.customerAddress || '',
              type: 'customer'
            });
            targetCustomerId = newCust.id;
            invalidateDashboardCache(tenantId);
            toast.success(`🎉 Auto-created new Customer: ${newCust.name}`);
          } catch (err) {
            console.error("Failed to auto-create customer:", err);
          }
        }
      }

      if (onScanComplete) {
        onScanComplete({
          customerId: targetCustomerId || '',
          customerName: parsedData.customerName || '',
          items: parsedData.items.length > 0 ? parsedData.items : [{ name: 'Scanned Item', qty: 1, price: 100, gst: 18, unit: 'Pcs' }]
        });
      }

      toast.success(`⚡ Extracted ${parsedData.items.length} product(s) & Populated Invoice!`);
      onClose();
    } catch (err) {
      console.error("Bill Scan Failed:", err);
      toast.error('Bill scanning failed. Please try a clearer photo or PDF.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '750px', width: '95%' }}>
        <div className="modal-header">
          <h3>📷 AI Paper Bill & Receipt Scanner (Auto Customer + Invoice Creator)</h3>
          <button className="close-button" type="button" onClick={() => { stopCamera(); onClose(); }}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Upload or Snap a Photo/PDF of a <strong>Paper Bill, Bill Pad, Receipt, or Supplier Invoice</strong>. Our AI will automatically:
            <br />1. Extract & <strong>Auto-Add Customer/Party</strong> details
            <br />2. Extract all <strong>Product Line Items, Qty & Prices</strong>
            <br />3. Auto-populate & create the invoice!
          </p>

          {/* Camera Viewfinder or File Dropzone */}
          {cameraActive ? (
            <div style={{ textAlign: 'center', background: '#0F172A', borderRadius: '12px', padding: '16px', position: 'relative' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '280px', borderRadius: '8px', objectFit: 'contain' }} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="primary-button" onClick={capturePhoto} style={{ background: '#10B981', color: '#fff', padding: '10px 20px', fontWeight: '600' }}>
                  📸 Snap Bill Photo & Scan
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
                  {file ? `Selected: ${file.name}` : 'Click or Drag & Drop Paper Bill Photo / PDF'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  Supports JPG, PNG, WEBP, PDF paper bills & receipts
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
                  Snap paper bill photo
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
              {scanning ? `⌛ ${statusText}` : '⚡ Start AI Bill Scanner & Auto-Populate Invoice'}
            </button>
          )}

          {scanning && (
            <div style={{ width: '100%', background: '#E2E8F0', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, background: '#4F46E5', height: '100%', transition: 'width 0.3s' }} />
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="secondary-button" onClick={() => { stopCamera(); onClose(); }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
