import React, { useState, useRef, useEffect } from 'react';

function BarcodeQRGenerator({ type = 'qr', data, label, onGenerate }) {
  const [qrData, setQrData] = useState(data || '');
  const [barcodeData, setBarcodeData] = useState(data || '');
  const [generated, setGenerated] = useState(false);
  const canvasRef = useRef(null);

  const generateQRCode = () => {
    if (!qrData) return;
    
    // Using a simple QR code API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
    setGenerated(true);
    if (onGenerate) onGenerate(qrUrl);
  };

  const generateBarcode = () => {
    if (!barcodeData) return;
    
    // Generate simple barcode using canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    // Simple barcode generation (Code 39 style)
    ctx.fillStyle = 'black';
    const barWidth = 3;
    const gapWidth = 2;
    
    // Convert data to binary-like pattern
    let x = 20;
    for (let i = 0; i < barcodeData.length; i++) {
      const charCode = barcodeData.charCodeAt(i);
      const binary = charCode.toString(2).padStart(8, '0');
      
      for (let j = 0; j < binary.length; j++) {
        if (binary[j] === '1') {
          ctx.fillRect(x, 20, barWidth, height - 40);
        }
        x += barWidth + gapWidth;
      }
      
      // Add gap between characters
      x += gapWidth * 2;
    }
    
    // Add label below barcode
    ctx.fillStyle = 'black';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(barcodeData, width / 2, height - 10);
    
    setGenerated(true);
    if (onGenerate) onGenerate(canvas.toDataURL());
  };

  // Auto-generate on load if data is present
  useEffect(() => {
    if (data) {
      setQrData(data);
      setBarcodeData(data);
      setGenerated(false);
      
      if (type === 'qr') {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
        setGenerated(true);
        if (onGenerate) onGenerate(qrUrl);
      } else {
        // Delay slightly for canvas ref binding
        const timer = setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = 'black';
            const barWidth = 3;
            const gapWidth = 2;
            let x = 20;
            for (let i = 0; i < data.length; i++) {
              const charCode = data.charCodeAt(i);
              const binary = charCode.toString(2).padStart(8, '0');
              for (let j = 0; j < binary.length; j++) {
                if (binary[j] === '1') {
                  ctx.fillRect(x, 20, barWidth, height - 40);
                }
                x += barWidth + gapWidth;
              }
              x += gapWidth * 2;
            }
            ctx.fillStyle = 'black';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(data, width / 2, height - 10);
            setGenerated(true);
            if (onGenerate) onGenerate(canvas.toDataURL());
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [type, data]);

  const downloadQR = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-code-${label || 'code'}.png`;
    link.target = '_blank';
    link.click();
  };

  const downloadBarcode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `barcode-${label || 'code'}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const reset = () => {
    setQrData('');
    setBarcodeData('');
    setGenerated(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="barcode-qr-generator">
      <div className="generator-header">
        <h3>{type === 'qr' ? '📱 QR Code Generator' : '📊 Barcode Generator'}</h3>
        {label && <span className="generator-label">{label}</span>}
      </div>

      <div className="generator-form">
        {type === 'qr' ? (
          <>
            <div className="form-label">
              <span>QR Code Data</span>
              <input 
                type="text" 
                className="form-input"
                placeholder="Enter URL, text, or data..."
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
              />
            </div>
            <div className="generator-actions">
              <button 
                className="primary-button" 
                onClick={generateQRCode}
                disabled={!qrData}
                type="button"
              >
                Generate QR Code
              </button>
              {generated && (
                <button 
                  className="secondary-button" 
                  onClick={downloadQR}
                  type="button"
                >
                  Download
                </button>
              )}
              <button 
                className="secondary-button" 
                onClick={reset}
                type="button"
              >
                Reset
              </button>
            </div>
            {generated && (
              <div className="generated-preview">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`} 
                  alt="QR Code"
                  className="qr-preview"
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-label">
              <span>Barcode Data</span>
              <input 
                type="text" 
                className="form-input"
                placeholder="Enter product code, serial number..."
                value={barcodeData}
                onChange={(e) => setBarcodeData(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="generator-actions">
              <button 
                className="primary-button" 
                onClick={generateBarcode}
                disabled={!barcodeData}
                type="button"
              >
                Generate Barcode
              </button>
              {generated && (
                <button 
                  className="secondary-button" 
                  onClick={downloadBarcode}
                  type="button"
                >
                  Download
                </button>
              )}
              <button 
                className="secondary-button" 
                onClick={reset}
                type="button"
              >
                Reset
              </button>
            </div>
            {generated && (
              <div className="generated-preview">
                <canvas 
                  ref={canvasRef} 
                  width={300} 
                  height={100} 
                  className="barcode-preview"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BarcodeQRGenerator;
