import React, { useState, useEffect } from 'react';
import PageSection from '../components/PageSection';
import { useUser } from '../lib/useUser';
import { supabase } from '../db';
import { getMigrationJobs, rollbackMigrationJob } from '../lib/db';
import './DataMigration.css';

const TARGET_TYPES = [
  { id: 'customers', label: '👥 Customers', table: 'customers', type: 'customer' },
  { id: 'suppliers', label: '🏭 Suppliers', table: 'customers', type: 'supplier' },
  { id: 'products', label: '📦 Products', table: 'products' },
  { id: 'invoices', label: '📄 Sales Invoices', table: 'invoices', type: 'sale' },
  { id: 'expenses', label: '💸 Expenses', table: 'expenses' },
];

const PRESETS = [
  { id: 'custom', label: '⚙️ Custom / Smart Map (Auto-Detect)' },
  { id: 'vyapar', label: '📱 Vyapar App' },
  { id: 'billbook', label: '📒 My BillBook' },
  { id: 'khatabook', label: '📕 Khatabook' },
  { id: 'tally', label: '📊 Tally ERP / Prime' },
  { id: 'busy', label: '💼 Busy Accounting' },
  { id: 'zoho', label: '🐘 Zoho Books' },
  { id: 'marg', label: '📈 Marg ERP' },
  { id: 'quickbooks', label: '🟢 QuickBooks' },
  { id: 'profitbooks', label: '💰 ProfitBooks' },
];

const SYNONYMS = {
  name: ['name', 'customer name', 'party name', 'ledger name', 'client name', 'account name', 'display name', 'contact name', 'full name', 'company name', 'item name', 'product name', 'stock item name'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number', 'contact number', 'phone no', 'mobile no', 'number', 'tel'],
  email: ['email', 'email address', 'email id', 'email_address', 'mail', 'primary email'],
  gstin: ['gstin', 'gst', 'gst number', 'gstin no', 'gstin/uin', 'tax id', 'registration number', 'tax identification number', 'vat number'],
  address: ['address', 'billing address', 'street', 'location', 'mailing address'],
  state: ['state', 'state name', 'region', 'province', 'state/province', 'place of supply'],
  balance: ['opening balance', 'balance', 'open balance', 'net balance', 'balance amount', 'balance due', 'outstanding'],
  hsn: ['hsn', 'hsn code', 'hsn/sac', 'sac', 'sac code', 'commodity code', 'tariff code'],
  stock: ['stock', 'opening stock', 'quantity', 'qty', 'stock qty', 'stock on hand', 'qty on hand', 'current stock', 'stock quantity'],
  sale_price: ['sale price', 'sales price', 'price', 'selling price', 'rate', 'sales rate', 'standard price', 'mrp'],
  purchase_price: ['purchase price', 'cost price', 'cost', 'purchase rate', 'buying price', 'unit cost', 'wholesale price'],
  unit: ['unit', 'base unit', 'uom', 'measurement unit', 'units', 'uom description'],
  invoice_no: ['invoice number', 'invoice no', 'invoice no.', 'bill number', 'bill no', 'bill no.', 'voucher no', 'voucher number', 'doc number', 'document number', 'invoice ref'],
  date: ['date', 'invoice date', 'bill date', 'voucher date', 'doc date', 'document date'],
  total: ['total', 'grand total', 'amount', 'total amount', 'net amount', 'invoice total', 'bill total'],
  paid: ['paid', 'paid amount', 'amount received', 'received', 'received amount', 'collected', 'amount collected'],
  category: ['category', 'expense category', 'expense name', 'ledger name', 'ledger', 'expense type'],
  description: ['description', 'notes', 'remarks', 'narration', 'memo', 'detail', 'details'],
  payment_mode: ['payment mode', 'payment method', 'pay mode', 'mode', 'method', 'account', 'source']
};

// Mappings preset lookup
const FIELD_PRESETS = {
  customers: {
    vyapar: { name: 'Party Name', phone: 'Phone No', email: 'Email', gstin: 'GSTIN', address: 'Address', state: 'State', balance: 'Opening Balance' },
    billbook: { name: 'Customer Name', phone: 'Mobile Number', email: 'Email Address', gstin: 'GSTIN', address: 'Billing Address', state: 'State', balance: 'Opening Balance' },
    khatabook: { name: 'Name', phone: 'Phone', email: 'Email', gstin: 'GSTIN', address: 'Address', state: 'State', balance: 'Net Balance' },
    tally: { name: 'Name', phone: 'Mobile', email: 'Email', gstin: 'GSTIN/UIN', address: 'Address', state: 'State', balance: 'Opening Balance' },
    busy: { name: 'Account Name', phone: 'Mobile No', email: 'Email', gstin: 'GSTIN', address: 'Address', state: 'State', balance: 'Opening Balance' },
    zoho: { name: 'Display Name', phone: 'Primary Contact Phone', email: 'Primary Contact Email', gstin: 'GSTIN', address: 'Billing Address', state: 'State/Province', balance: 'Opening Balance' },
    marg: { name: 'Ledger Name', phone: 'Mobile No.', email: 'Email Id', gstin: 'GSTIN No.', address: 'Address', state: 'State', balance: 'Balance' },
    quickbooks: { name: 'Customer', phone: 'Phone', email: 'Email', gstin: 'Tax ID', address: 'Billing Address', state: 'State', balance: 'Open Balance' },
    profitbooks: { name: 'Customer Name', phone: 'Phone', email: 'Email Address', gstin: 'GSTIN', address: 'Address', state: 'State', balance: 'Opening Balance' }
  },
  products: {
    vyapar: { name: 'Item Name', hsn: 'HSN Code', gst: 'Tax Rate', stock: 'Opening Stock', sale_price: 'Sale Price', purchase_price: 'Purchase Price', unit: 'Unit' },
    billbook: { name: 'Item Name', hsn: 'HSN Code', gst: 'GST Percent', stock: 'Opening Stock', sale_price: 'Sales Price', purchase_price: 'Purchase Price', unit: 'Measurement Unit' },
    khatabook: { name: 'Item Name', hsn: 'HSN', gst: 'GST Rate', stock: 'Stock', sale_price: 'Sale Price', purchase_price: 'Purchase Price', unit: 'Unit' },
    tally: { name: 'Stock Item Name', hsn: 'HSN/SAC', gst: 'GST Rate', stock: 'Opening Qty', sale_price: 'Standard Selling Price', purchase_price: 'Standard Cost', unit: 'Base Unit' },
    busy: { name: 'Item Name', hsn: 'HSN Code', gst: 'Tax Category', stock: 'Stock', sale_price: 'Sales Price', purchase_price: 'Purchase Price', unit: 'Unit' },
    zoho: { name: 'Item Name', hsn: 'HSN/SAC', gst: 'GST Rate', stock: 'Stock on Hand', sale_price: 'Rate', purchase_price: 'Purchase Rate', unit: 'Unit' },
    marg: { name: 'Item Name', hsn: 'HSN Code', gst: 'GST %', stock: 'Stock Qty', sale_price: 'Sale Rate', purchase_price: 'Purc. Rate', unit: 'Unit' },
    quickbooks: { name: 'Product/Service Name', hsn: 'HSN', gst: 'Taxable/GST Rate', stock: 'QTY on Hand', sale_price: 'Sales Price', purchase_price: 'Cost', unit: 'Unit' },
    profitbooks: { name: 'Product Name', hsn: 'SKU/HSN', gst: 'GST Rate', stock: 'Current Stock', sale_price: 'Price', purchase_price: 'Cost', unit: 'Unit' }
  },
  invoices: {
    vyapar: { invoice_no: 'Invoice No', date: 'Date', customer_name: 'Party Name', total: 'Total', paid: 'Received', balance: 'Balance', notes: 'Notes' },
    billbook: { invoice_no: 'Invoice Number', date: 'Invoice Date', customer_name: 'Customer Name', total: 'Total Amount', paid: 'Amount Received', balance: 'Balance Amount', notes: 'Notes' },
    khatabook: { invoice_no: 'Invoice No', date: 'Date', customer_name: 'Party Name', total: 'Amount', paid: 'Paid', balance: 'Balance', notes: 'Notes' },
    tally: { invoice_no: 'Voucher No', date: 'Date', customer_name: 'Party Name', total: 'Amount', paid: 'Paid', balance: 'Balance', notes: 'Narration' },
    busy: { invoice_no: 'Bill No', date: 'Date', customer_name: 'Party', total: 'Grand Total', paid: 'Received', balance: 'Balance', notes: 'Remarks' },
    zoho: { invoice_no: 'Invoice Number', date: 'Invoice Date', customer_name: 'Customer Name', total: 'Total', paid: 'Paid', balance: 'Balance Due', notes: 'Notes' },
    marg: { invoice_no: 'Bill No.', date: 'Bill Date', customer_name: 'Party Name', total: 'Net Amount', paid: 'Received', balance: 'Balance', notes: 'Remark' },
    quickbooks: { invoice_no: 'No.', date: 'Date', customer_name: 'Customer Name', total: 'Total Amount', paid: 'Amount Paid', balance: 'Balance Amount', notes: 'Memo' },
    profitbooks: { invoice_no: 'Invoice No', date: 'Date', customer_name: 'Party Name', total: 'Total', paid: 'Paid Amount', balance: 'Balance Due', notes: 'Remarks' }
  },
  expenses: {
    vyapar: { category: 'Category', amount: 'Amount', date: 'Date', description: 'Description', payment_mode: 'Payment Mode' },
    billbook: { category: 'CategoryName', amount: 'ExpenseAmount', date: 'Date', description: 'Description', payment_mode: 'PaymentMode' },
    khatabook: { category: 'Category', amount: 'Amount', date: 'Date', description: 'Description', payment_mode: 'Mode' },
    tally: { category: 'Ledger Name', amount: 'Amount', date: 'Date', description: 'Narration', payment_mode: 'Payment Mode' },
    busy: { category: 'Expense Name', amount: 'Amount', date: 'Date', description: 'Description', payment_mode: 'Mode' },
    zoho: { category: 'Expense Category', amount: 'Amount', date: 'Date', description: 'Description', payment_mode: 'Payment Mode' },
    marg: { category: 'Ledger Name', amount: 'Amount', date: 'Date', description: 'Details', payment_mode: 'Pay Mode' },
    quickbooks: { category: 'Category', amount: 'Amount', date: 'Date', description: 'Description', payment_mode: 'Payment Method' },
    profitbooks: { category: 'Expense Category', amount: 'Amount', date: 'Date', description: 'Description', payment_mode: 'Payment Method' }
  }
};

const FIELDS_CONFIG = {
  customers: [
    { key: 'name', label: 'Name', required: true },
    { key: 'phone', label: 'Phone / Mobile', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'gstin', label: 'GSTIN', required: false },
    { key: 'address', label: 'Address', required: false },
    { key: 'state', label: 'State', required: false },
    { key: 'balance', label: 'Opening Balance', required: false },
  ],
  products: [
    { key: 'name', label: 'Product Name', required: true },
    { key: 'hsn', label: 'HSN Code', required: false },
    { key: 'gst', label: 'GST Rate (%)', required: false },
    { key: 'stock', label: 'Opening Stock', required: false },
    { key: 'sale_price', label: 'Sale Price', required: false },
    { key: 'purchase_price', label: 'Purchase Price', required: false },
    { key: 'unit', label: 'Unit', required: false },
  ],
  invoices: [
    { key: 'invoice_no', label: 'Invoice Number', required: true },
    { key: 'date', label: 'Invoice Date', required: false },
    { key: 'customer_name', label: 'Customer Name', required: true },
    { key: 'total', label: 'Total Amount', required: true },
    { key: 'paid', label: 'Paid Amount', required: false },
    { key: 'balance', label: 'Balance Amount', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
  expenses: [
    { key: 'category', label: 'Category', required: true },
    { key: 'amount', label: 'Amount', required: true },
    { key: 'date', label: 'Date', required: false },
    { key: 'description', label: 'Description', required: false },
    { key: 'payment_mode', label: 'Payment Mode (Cash, Bank, UPI)', required: false },
  ]
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  });
}

function DataMigration() {
  const { userId } = useUser();
  const [step, setStep] = useState(1); // Steps: 1 (Upload), 2 (Map), 3 (Preview & Config), 4 (Importing), 5 (Summary)
  
  // Dashboard & History Stats
  const [dashboardStats, setDashboardStats] = useState({ totalImported: 0, totalFailed: 0, lastMigration: '—', successRate: '0%' });
  const [historyJobs, setHistoryJobs] = useState([]);
  
  // Importer State
  const [importFiles, setImportFiles] = useState([]); // List of { id, file, targetType, preset, headers, rows, mappings, duplicatesAction }
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [validationResults, setValidationResults] = useState({}); // { [fileId]: [ { isValid, errors, data, duplicateAction } ] }
  
  // Processing State
  const [progressState, setProgressState] = useState({ activeFileId: null, currentIdx: 0, totalIdx: 0, percentage: 0 });
  const [auditLogs, setAuditLogs] = useState([]);
  const [failedRowsReport, setFailedRowsReport] = useState({}); // { [fileId]: [ { originalRow, error } ] }
  const [isProcessing, setIsProcessing] = useState(false);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (userId) {
      loadHistoryJobs();
    }
  }, [userId]);

  const loadHistoryJobs = async () => {
    try {
      const data = await getMigrationJobs(userId);
      setHistoryJobs(data || []);

      // Calculate stats
      const totalImported = data.reduce((sum, j) => sum + (j.status !== 'rolled_back' ? (j.imported_records || 0) : 0), 0);
      const totalFailed = data.reduce((sum, j) => sum + (j.failed_records || 0), 0);
      const totalProcessed = data.reduce((sum, j) => sum + (j.total_records || 0), 0);
      const lastMigration = data.length > 0 ? new Date(data[0].created_at).toLocaleString() : '—';
      const successRate = totalProcessed > 0 ? `${Math.round((totalImported / totalProcessed) * 100)}%` : '0%';

      setDashboardStats({ totalImported, totalFailed, lastMigration, successRate });
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    processUploadedFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.csv'));
    processUploadedFiles(files);
  };

  const processUploadedFiles = (files) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const parsed = parseCSV(event.target.result);
        if (parsed.length < 2) return;

        const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
        const newFile = {
          id: fileId,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          targetType: 'customers',
          preset: 'custom',
          headers: parsed[0],
          rows: parsed.slice(1),
          mappings: {},
          duplicatesAction: 'skip', // Options: 'skip', 'update', 'force'
        };

        // Apply default mappings using Smart Map synonyms
        const fields = FIELDS_CONFIG.customers;
        fields.forEach(f => {
          const alternatives = SYNONYMS[f.key] || [];
          const match = newFile.headers.find(h => {
            const hClean = h.toLowerCase().trim();
            return alternatives.some(alt => hClean === alt.toLowerCase() || hClean.includes(alt.toLowerCase()));
          });
          newFile.mappings[f.key] = match || '';
        });

        setImportFiles(prev => [...prev, newFile]);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (id) => {
    setImportFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileConfig = (id, key, value) => {
    setImportFiles(prev => prev.map(f => {
      if (f.id !== id) return f;

      const updated = { ...f, [key]: value };
      if (key === 'targetType' || key === 'preset') {
        const fields = FIELDS_CONFIG[updated.targetType];
        const newMappings = {};
        const presetMap = FIELD_PRESETS[updated.targetType]?.[updated.preset] || {};

        fields.forEach(field => {
          let alternatives = presetMap[field.key] || [];
          if (updated.preset === 'custom') {
            alternatives = SYNONYMS[field.key] || [];
          }

          const match = updated.headers.find(h => {
            const hClean = h.toLowerCase().trim();
            if (typeof alternatives === 'string') {
              return hClean === alternatives.toLowerCase() || hClean.includes(alternatives.toLowerCase());
            }
            if (Array.isArray(alternatives)) {
              return alternatives.some(alt => hClean === alt.toLowerCase() || hClean.includes(alt.toLowerCase()));
            }
            // Fallback to synonyms lookup if not found in preset
            const backupAlts = SYNONYMS[field.key] || [];
            return backupAlts.some(alt => hClean === alt.toLowerCase() || hClean.includes(alt.toLowerCase())) ||
                   hClean === field.key.toLowerCase();
          });
          newMappings[field.key] = match || '';
        });
        updated.mappings = newMappings;
      }
      return updated;
    }));
  };

  const handleMappingChange = (fileId, fieldKey, value) => {
    setImportFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return { ...f, mappings: { ...f.mappings, [fieldKey]: value } };
    }));
  };

  const runValidation = async () => {
    setGeneralError('');
    const allResults = {};
    
    // Perform duplicate detection & validation locally
    for (const f of importFiles) {
      const results = [];
      const fields = FIELDS_CONFIG[f.targetType];

      // Fetch existing records for duplicate check
      let existingSet = new Set();
      let existingMap = {}; // name -> id (used for mapping invoices to customers or tracking barcodes)
      
      try {
        if (f.targetType === 'customers' || f.targetType === 'suppliers') {
          const { data } = await supabase.from('customers').select('id, name, phone, gstin, email').eq('user_id', userId);
          (data || []).forEach(row => {
            if (row.phone) existingSet.add(row.phone.toLowerCase().replace(/\s+/g, ''));
            if (row.gstin) existingSet.add(row.gstin.toLowerCase().replace(/\s+/g, ''));
            if (row.email) existingSet.add(row.email.toLowerCase().trim());
            existingMap[row.name.toLowerCase()] = row.id;
          });
        } else if (f.targetType === 'products') {
          const { data } = await supabase.from('products').select('id, name, hsn').eq('user_id', userId);
          (data || []).forEach(row => {
            existingSet.add(row.name.toLowerCase().trim());
            if (row.hsn) existingSet.add(row.hsn.toLowerCase().trim());
            existingMap[row.name.toLowerCase()] = row.id;
          });
        } else if (f.targetType === 'invoices') {
          const { data } = await supabase.from('invoices').select('id, invoice_no').eq('user_id', userId).eq('type', 'sale');
          (data || []).forEach(row => {
            existingSet.add(row.invoice_no.toLowerCase().trim());
          });
        }
      } catch (err) {
        console.error('Validation duplicate prefetch error:', err);
      }

      f.rows.forEach((row, rowIndex) => {
        const rowObj = {};
        const errors = [];
        
        f.headers.forEach((h, idx) => {
          rowObj[h] = row[idx] || '';
        });

        const mappedData = {};
        fields.forEach(cfg => {
          const csvCol = f.mappings[cfg.key];
          mappedData[cfg.key] = csvCol ? rowObj[csvCol] : '';
        });

        // Validation: Required check
        fields.forEach(cfg => {
          if (cfg.required && !mappedData[cfg.key]) {
            errors.push(`Missing required field: ${cfg.label}`);
          }
        });

        // Duplicate check
        let isDuplicate = false;
        let dupValue = '';

        if (f.targetType === 'customers' || f.targetType === 'suppliers') {
          const phoneClean = mappedData.phone ? mappedData.phone.toLowerCase().replace(/\s+/g, '') : '';
          const gstinClean = mappedData.gstin ? mappedData.gstin.toLowerCase().replace(/\s+/g, '') : '';
          const emailClean = mappedData.email ? mappedData.email.toLowerCase().trim() : '';

          if (phoneClean && existingSet.has(phoneClean)) { isDuplicate = true; dupValue = mappedData.phone; }
          else if (gstinClean && existingSet.has(gstinClean)) { isDuplicate = true; dupValue = mappedData.gstin; }
          else if (emailClean && existingSet.has(emailClean)) { isDuplicate = true; dupValue = mappedData.email; }
        } else if (f.targetType === 'products') {
          const nameClean = mappedData.name ? mappedData.name.toLowerCase().trim() : '';
          const hsnClean = mappedData.hsn ? mappedData.hsn.toLowerCase().trim() : '';

          if (nameClean && existingSet.has(nameClean)) { isDuplicate = true; dupValue = mappedData.name; }
          else if (hsnClean && existingSet.has(hsnClean)) { isDuplicate = true; dupValue = mappedData.hsn; }
        } else if (f.targetType === 'invoices') {
          const invClean = mappedData.invoice_no ? mappedData.invoice_no.toLowerCase().trim() : '';
          if (invClean && existingSet.has(invClean)) { isDuplicate = true; dupValue = mappedData.invoice_no; }
        }

        results.push({
          rowIndex,
          data: mappedData,
          originalRow: row,
          isValid: errors.length === 0,
          errors,
          isDuplicate,
          dupValue
        });
      });

      allResults[f.id] = results;
    }

    setValidationResults(allResults);
    setStep(3);
  };

  const handleRollback = async (jobId) => {
    if (!window.confirm('Are you sure you want to rollback this import? This will atomically delete all records imported in this batch.')) return;
    
    try {
      await rollbackMigrationJob(jobId);
      loadHistoryJobs();
      alert('✓ Rollback completed successfully!');
    } catch (err) {
      console.error(err);
      alert('Rollback failed: ' + err.message);
    }
  };

  const downloadFailedCSV = (fileId, fileName) => {
    const reports = failedRowsReport[fileId];
    if (!reports || reports.length === 0) return;

    const file = importFiles.find(f => f.id === fileId);
    if (!file) return;

    const csvHeadersList = ['Error Reason', ...file.headers];
    const csvRowsList = reports.map(r => [r.error, ...r.originalRow]);
    
    const content = [
      csvHeadersList.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...csvRowsList.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `failed_report_${fileName}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Perform chunked batch imports
  const startImportFlow = async () => {
    setIsProcessing(true);
    setStep(4);
    setAuditLogs([]);
    setFailedRowsReport({});

    const chunkBatchSize = 200; // Yield thread to avoid page freezing

    for (let fIdx = 0; fIdx < importFiles.length; fIdx++) {
      const f = importFiles[fIdx];
      const rows = validationResults[f.id] || [];
      const total = rows.length;

      let importedCount = 0;
      let failedCount = 0;
      const failedList = [];
      const createdIds = { customers: [], products: [], invoices: [], expenses: [] };

      // Create migration job first to get job ID
      let jobId;
      try {
        const { data: job, error: jobErr } = await supabase
          .from('migration_jobs')
          .insert([{
            user_id: userId,
            source_software: f.preset.toUpperCase(),
            import_type: f.targetType.toUpperCase(),
            file_name: f.name,
            total_records: total,
            imported_records: 0,
            failed_records: 0,
            status: 'processing',
            imported_ids: createdIds
          }])
          .select()
          .single();
        if (jobErr) throw jobErr;
        jobId = job.id;
      } catch (err) {
        console.error('Failed to create migration job metadata:', err);
        setGeneralError('Could not initialize migration job metadata.');
        setIsProcessing(false);
        setStep(3); // go back
        return;
      }

      // Prefetch map for lookups
      const customerMap = {};
      const productMap = {};
      try {
        const { data: customerList } = await supabase.from('customers').select('id, name').eq('user_id', userId);
        (customerList || []).forEach(c => { customerMap[c.name.toLowerCase()] = c.id; });

        const { data: productList } = await supabase.from('products').select('id, name').eq('user_id', userId);
        (productList || []).forEach(p => { productMap[p.name.toLowerCase()] = p.id; });
      } catch (err) {
        console.error('Pre-import fetch error:', err);
      }

      setProgressState({ activeFileId: f.id, currentIdx: 0, totalIdx: total, percentage: 0 });

      // Process in batches
      for (let i = 0; i < total; i += chunkBatchSize) {
        const batch = rows.slice(i, i + chunkBatchSize);
        
        // Yield execution thread
        await new Promise(resolve => setTimeout(resolve, 30));

        // Process batch items
        for (const item of batch) {
          if (!item.isValid) {
            failedCount++;
            failedList.push({ originalRow: item.originalRow, error: item.errors.join(', ') });
            continue;
          }

          try {
            if (f.targetType === 'customers' || f.targetType === 'suppliers') {
              const partyType = f.targetType === 'customers' ? 'customer' : 'supplier';
              
              if (item.isDuplicate) {
                if (f.duplicatesAction === 'skip') {
                  setAuditLogs(prev => [...prev, `[Skip] Customer duplicate phone/email: ${item.dupValue}`]);
                  continue;
                } else if (f.duplicatesAction === 'update') {
                  // Resolve ID to update
                  const { data: dupRecord } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('user_id', userId)
                    .or(`phone.eq.${item.data.phone},email.eq.${item.data.email},gstin.eq.${item.data.gstin}`)
                    .limit(1)
                    .maybeSingle();

                  if (dupRecord) {
                    await supabase.from('customers').update({ ...item.data }).eq('id', dupRecord.id);
                    setAuditLogs(prev => [...prev, `[Update] Customer updated: ${item.data.name}`]);
                    importedCount++;
                    continue;
                  }
                }
              }

              // Create New
              const { data: newCust, error } = await supabase
                .from('customers')
                .insert([{ ...item.data, type: partyType, user_id: userId, migration_job_id: jobId }])
                .select()
                .single();

              if (error) throw error;
              createdIds.customers.push(newCust.id);
              importedCount++;
              setAuditLogs(prev => [...prev, `[Create] Customer created: ${item.data.name}`]);

            } else if (f.targetType === 'products') {
              if (item.isDuplicate) {
                if (f.duplicatesAction === 'skip') {
                  setAuditLogs(prev => [...prev, `[Skip] Product duplicate: ${item.dupValue}`]);
                  continue;
                } else if (f.duplicatesAction === 'update') {
                  const { data: dupRecord } = await supabase
                    .from('products')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('name', item.data.name)
                    .limit(1)
                    .maybeSingle();

                  if (dupRecord) {
                    await supabase.from('products').update({
                      hsn: item.data.hsn,
                      gst: parseFloat(item.data.gst) || 18,
                      stock: parseFloat(item.data.stock) || 0,
                      sale_price: parseFloat(item.data.sale_price) || 0,
                      purchase_price: parseFloat(item.data.purchase_price) || 0,
                      unit: item.data.unit || 'Pcs',
                    }).eq('id', dupRecord.id);
                    setAuditLogs(prev => [...prev, `[Update] Product updated: ${item.data.name}`]);
                    importedCount++;
                    continue;
                  }
                }
              }

              // Create New
              const { data: newProd, error } = await supabase
                .from('products')
                .insert([{
                  user_id: userId,
                  name: item.data.name,
                  hsn: item.data.hsn,
                  gst: parseFloat(item.data.gst) || 18,
                  stock: parseFloat(item.data.stock) || 0,
                  sale_price: parseFloat(item.data.sale_price) || 0,
                  purchase_price: parseFloat(item.data.purchase_price) || 0,
                  unit: item.data.unit || 'Pcs',
                  migration_job_id: jobId,
                }])
                .select()
                .single();

              if (error) throw error;
              createdIds.products.push(newProd.id);
              importedCount++;
              setAuditLogs(prev => [...prev, `[Create] Product created: ${item.data.name}`]);

            } else if (f.targetType === 'invoices') {
              if (item.isDuplicate) {
                if (f.duplicatesAction === 'skip') {
                  setAuditLogs(prev => [...prev, `[Skip] Invoice duplicate no: ${item.dupValue}`]);
                  continue;
                } else if (f.duplicatesAction === 'update') {
                  const { data: dupRecord } = await supabase
                    .from('invoices')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('invoice_no', item.data.invoice_no)
                    .limit(1)
                    .maybeSingle();

                  if (dupRecord) {
                    const parsedTotal = parseFloat(item.data.total) || 0;
                    const parsedPaid = parseFloat(item.data.paid) || 0;
                    await supabase.from('invoices').update({
                      date: item.data.date || new Date().toISOString().split('T')[0],
                      total: parsedTotal,
                      paid: parsedPaid,
                      balance: parseFloat(item.data.balance) || (parsedTotal - parsedPaid),
                      notes: item.data.notes,
                    }).eq('id', dupRecord.id);
                    setAuditLogs(prev => [...prev, `[Update] Invoice updated: ${item.data.invoice_no}`]);
                    importedCount++;
                    continue;
                  }
                }
              }

              // Auto Customer Creation
              let customerId = customerMap[item.data.customer_name.toLowerCase()];
              if (!customerId && item.data.customer_name) {
                const { data: newCust, error: custErr } = await supabase
                  .from('customers')
                  .insert([{ name: item.data.customer_name, type: 'customer', user_id: userId, migration_job_id: jobId }])
                  .select()
                  .single();

                if (custErr) throw custErr;
                customerId = newCust.id;
                customerMap[item.data.customer_name.toLowerCase()] = customerId;
                createdIds.customers.push(customerId);
                setAuditLogs(prev => [...prev, `[Auto-Customer] Customer auto-created: ${item.data.customer_name}`]);
              }

              const parsedTotal = parseFloat(item.data.total) || 0;
              const parsedPaid = parseFloat(item.data.paid) || 0;
              const parsedBalance = parseFloat(item.data.balance) || (parsedTotal - parsedPaid);
              const computedStatus = parsedPaid >= parsedTotal ? 'paid' : parsedPaid > 0 ? 'partial' : 'unpaid';

              const { data: newInv, error } = await supabase
                .from('invoices')
                .insert([{
                  user_id: userId,
                  invoice_no: item.data.invoice_no,
                  type: 'sale',
                  document_kind: 'sale_invoice',
                  customer_id: customerId,
                  date: item.data.date || new Date().toISOString().split('T')[0],
                  subtotal: parsedTotal,
                  total: parsedTotal,
                  paid: parsedPaid,
                  balance: parsedBalance,
                  status: computedStatus,
                  notes: item.data.notes || 'Imported from advanced migration center',
                  migration_job_id: jobId,
                }])
                .select()
                .single();

              if (error) throw error;
              createdIds.invoices.push(newInv.id);
              importedCount++;
              setAuditLogs(prev => [...prev, `[Create] Invoice created: ${item.data.invoice_no}`]);

            } else if (f.targetType === 'expenses') {
              const { data: newExp, error } = await supabase
                .from('expenses')
                .insert([{
                  user_id: userId,
                  category: item.data.category,
                  amount: parseFloat(item.data.amount) || 0,
                  date: item.data.date || new Date().toISOString().split('T')[0],
                  description: item.data.description || 'Imported expense',
                  payment_mode: item.data.payment_mode || 'Cash',
                  migration_job_id: jobId,
                }])
                .select()
                .single();

              if (error) throw error;
              createdIds.expenses.push(newExp.id);
              importedCount++;
              setAuditLogs(prev => [...prev, `[Create] Expense created: ${item.data.category}`]);
            }
          } catch (err) {
            console.error('Import row failure:', err);
            failedCount++;
            failedList.push({ originalRow: item.originalRow, error: err.message || 'Supabase write error' });
          }
        }

        // Update progress state
        const processed = Math.min(i + chunkBatchSize, total);
        const percentage = Math.round((processed / total) * 100);
        setProgressState({ activeFileId: f.id, currentIdx: processed, totalIdx: total, percentage });
      }

      // Log/Update the Job entry in migration_jobs
      try {
        await supabase
          .from('migration_jobs')
          .update({
            imported_records: importedCount,
            failed_records: failedCount,
            status: failedCount === total ? 'failed' : 'completed',
            imported_ids: createdIds,
          })
          .eq('id', jobId);
      } catch (err) {
        console.error('Failed to update migration job entry:', err);
      }

      setFailedRowsReport(prev => ({ ...prev, [f.id]: failedList }));
    }

    setIsProcessing(false);
    loadHistoryJobs();
    setStep(5);
  };

  const getActiveFile = () => importFiles[activeFileIndex] || null;

  return (
    <PageSection eyebrow="Migration" title="Advanced Migration Center" description="Enterprise-grade data mapping, duplicate handling, batch imports, and rollbacks.">
      
      {/* Import Dashboard Metrics */}
      {step === 1 && (
        <>
          <div className="summary-stats-box">
            <div className="summary-stat-item">
              <span className="summary-stat-label">Total Imported Records</span>
              <h3 className="summary-stat-value" style={{ color: 'var(--success)' }}>{dashboardStats.totalImported}</h3>
            </div>
            <div className="summary-stat-item">
              <span className="summary-stat-label">Failed Imports</span>
              <h3 className="summary-stat-value" style={{ color: 'var(--danger)' }}>{dashboardStats.totalFailed}</h3>
            </div>
            <div className="summary-stat-item">
              <span className="summary-stat-label">Last Migration Run</span>
              <h3 className="summary-stat-value" style={{ fontSize: '15px', color: 'var(--text-primary)', marginTop: '12px' }}>{dashboardStats.lastMigration}</h3>
            </div>
            <div className="summary-stat-item">
              <span className="summary-stat-label">Success Rate</span>
              <h3 className="summary-stat-value" style={{ color: 'var(--accent)' }}>{dashboardStats.successRate}</h3>
            </div>
          </div>
        </>
      )}

      {/* Stepper Navigation */}
      {step > 1 && (
        <div className="stepper-container">
          <div className="stepper-line" />
          <div className={`step-item ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Map Columns</span>
          </div>
          <div className={`step-item ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Preview & Duplicate</span>
          </div>
          <div className={`step-item ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Progress</span>
          </div>
          <div className={`step-item ${step === 5 ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">Summary</span>
          </div>
        </div>
      )}

      {/* STEP 1: Upload Files & Queue */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div 
            className="drag-drop-zone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('migration-file-input').click()}
          >
            <span className="dropzone-icon">📥</span>
            <span className="dropzone-text">Drag & drop your CSV files here, or click to browse</span>
            <span className="dropzone-subtext">Supports files exported from Vyapar, MyBillBook, Khatabook, Tally, and Busy (.csv)</span>
            <input 
              id="migration-file-input" 
              type="file" 
              accept=".csv" 
              multiple 
              style={{ display: 'none' }} 
              onChange={handleFileSelect} 
            />
          </div>

          {importFiles.length > 0 && (
            <div className="content-card" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Config Files Queue</h3>
              <div className="uploaded-files-list">
                {importFiles.map((f, idx) => (
                  <div key={f.id} className="uploaded-file-card">
                    <div className="file-info">
                      <span className="file-icon">📁</span>
                      <div className="file-meta">
                        <span className="file-name">{f.name}</span>
                        <span className="file-size-type">{f.size} • {f.rows.length} rows detected</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select 
                        className="form-select" 
                        value={f.targetType} 
                        onChange={(e) => updateFileConfig(f.id, 'targetType', e.target.value)}
                        style={{ width: '160px', padding: '6px' }}
                      >
                        {TARGET_TYPES.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>

                      <select 
                        className="form-select" 
                        value={f.preset} 
                        onChange={(e) => updateFileConfig(f.id, 'preset', e.target.value)}
                        style={{ width: '160px', padding: '6px' }}
                      >
                        {PRESETS.map(p => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>

                      <button className="remove-file-btn" onClick={() => removeFile(f.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="action-button primary animate-hover" onClick={runValidation}>
                  Next: Map Columns & Validation
                </button>
              </div>
            </div>
          )}

          {/* Job History */}
          <div className="content-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Migration Logs & Rollbacks</h3>
            {historyJobs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🕒</span>
                <p className="muted-text">No migration history found.</p>
              </div>
            ) : (
              <div className="history-jobs-list">
                {historyJobs.map(job => (
                  <div key={job.id} className="job-history-item">
                    <div className="job-info-col">
                      <span className="job-info-title">{job.file_name}</span>
                      <div className="job-info-meta">
                        <span>Software: <strong>{job.source_software}</strong></span>
                        <span>Type: <strong>{job.import_type}</strong></span>
                        <span>Date: <strong>{new Date(job.created_at).toLocaleDateString()}</strong></span>
                        <span>Status: <strong style={{ color: job.status === 'rolled_back' ? 'var(--text-muted)' : job.status === 'failed' ? 'var(--danger)' : 'var(--success)' }}>{job.status.toUpperCase()}</strong></span>
                      </div>
                    </div>
                    <div className="job-stats-col">
                      <div className="job-stats-counts">
                        <span style={{ color: 'var(--success)', fontWeight: '600' }}>{job.imported_records} Imported</span>
                        {job.failed_records > 0 && (
                          <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{job.failed_records} Failed</span>
                        )}
                      </div>
                      {job.status === 'completed' && (
                        <button className="action-button danger-btn" onClick={() => handleRollback(job.id)}>
                          Undo Import
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Header mapping */}
      {step === 2 && getActiveFile() && (
        <div className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <span className="badge info" style={{ marginBottom: '6px', display: 'inline-block' }}>
                File {activeFileIndex + 1} of {importFiles.length}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Map Columns: {getActiveFile().name}
              </h3>
            </div>
            <div>
              <span className="muted-text" style={{ fontSize: '13px' }}>
                Import Target: <strong>{getActiveFile().targetType.toUpperCase()}</strong>
              </span>
            </div>
          </div>

          <div className="mapping-grid-container" style={{ marginBottom: '24px' }}>
            {FIELDS_CONFIG[getActiveFile().targetType].map(field => (
              <div key={field.key} className="mapping-row">
                <span className="mapping-field-label">
                  {field.label} {field.required && <span className="mapping-required-star">*</span>}
                </span>
                <select
                  className="form-select"
                  value={getActiveFile().mappings[field.key] || ''}
                  onChange={(e) => handleMappingChange(getActiveFile().id, field.key, e.target.value)}
                >
                  <option value="">-- Do Not Map / Keep Empty --</option>
                  {getActiveFile().headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="action-button" onClick={() => setStep(1)}>
              Back to Uploads
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              {activeFileIndex > 0 && (
                <button className="action-button" onClick={() => setActiveFileIndex(prev => prev - 1)}>
                  Previous File
                </button>
              )}
              {activeFileIndex < importFiles.length - 1 ? (
                <button className="action-button primary" onClick={() => setActiveFileIndex(prev => prev + 1)}>
                  Next File mapping
                </button>
              ) : (
                <button className="action-button primary animate-hover" onClick={runValidation}>
                  Validate & Preview Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Preview validation errors & duplicate configurations */}
      {step === 3 && getActiveFile() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* File Picker tabs */}
          {importFiles.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {importFiles.map((f, idx) => (
                <button 
                  key={f.id} 
                  className={`range-btn ${activeFileIndex === idx ? 'active' : ''}`}
                  onClick={() => setActiveFileIndex(idx)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Duplicate Resolution Strategy */}
          <div className="duplicate-settings-container">
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#92400E' }}>
              ⚡ Duplicate Detection Strategy for {getActiveFile().name}
            </h4>
            <p style={{ margin: '4px 0 12px 0', fontSize: '13px', color: '#B45309' }}>
              Matches will be checked against your current account. Specify what to do if duplicates are found:
            </p>
            <div className="duplicate-options-row">
              <button 
                className={`resolution-btn ${getActiveFile().duplicatesAction === 'skip' ? 'active' : ''}`}
                onClick={() => updateFileConfig(getActiveFile().id, 'duplicatesAction', 'skip')}
              >
                Skip Rows
              </button>
              <button 
                className={`resolution-btn ${getActiveFile().duplicatesAction === 'update' ? 'active' : ''}`}
                onClick={() => updateFileConfig(getActiveFile().id, 'duplicatesAction', 'update')}
              >
                Update / Overwrite Existing
              </button>
              <button 
                className={`resolution-btn ${getActiveFile().duplicatesAction === 'force' ? 'active' : ''}`}
                onClick={() => updateFileConfig(getActiveFile().id, 'duplicatesAction', 'force')}
              >
                Create New (Keep both)
              </button>
            </div>
          </div>

          {/* Preview Row Validations */}
          <div className="content-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              Preview Row Verifications
            </h3>
            
            <div className="simple-table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    {FIELDS_CONFIG[getActiveFile().targetType].map(f => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th>Mapping Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {(validationResults[getActiveFile().id] || []).slice(0, 10).map((result, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ fontSize: '16px' }}>
                          {result.errors.length > 0 ? '❌' : result.isDuplicate ? '⚠️' : '✅'}
                        </span>
                      </td>
                      {FIELDS_CONFIG[getActiveFile().targetType].map(f => (
                        <td key={f.key}>{result.data[f.key] || '—'}</td>
                      ))}
                      <td style={{ fontSize: '12px' }}>
                        {result.errors.length > 0 ? (
                          <span style={{ color: 'var(--danger)' }}>{result.errors.join(', ')}</span>
                        ) : result.isDuplicate ? (
                          <span style={{ color: 'var(--warning)', fontWeight: '500' }}>Duplicate detected ({result.dupValue})</span>
                        ) : (
                          <span style={{ color: 'var(--success)' }}>Ready to import</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button className="action-button" onClick={() => setStep(2)}>
                Back to Map
              </button>
              <button className="action-button primary animate-hover" onClick={startImportFlow}>
                Start Bulk Migration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Live progress bar chunking */}
      {step === 4 && (
        <div className="content-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: '42px', animation: 'spin 2s linear infinite', display: 'inline-block' }}>🔄</span>
          <h3 style={{ margin: '16px 0 8px 0', fontSize: '20px', fontWeight: '600' }}>Processing Advanced Migrations</h3>
          <p className="muted-text" style={{ margin: '0 0 24px 0' }}>
            Chunks are importing. Processing records batch-by-batch without browser locks.
          </p>

          <div style={{ maxWidth: '450px', margin: '0 auto' }}>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progressState.percentage}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
              <span>Batch Row: <strong>{progressState.currentIdx}</strong> / <strong>{progressState.totalIdx}</strong></span>
              <span><strong>{progressState.percentage}%</strong></span>
            </div>
          </div>

          <div className="simple-table-wrapper" style={{ marginTop: '32px', maxHeight: '180px', textAlign: 'left', background: '#F8FAFC', padding: '12px', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Audit Log</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
              {auditLogs.slice(-6).map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Migration summary */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="content-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <span style={{ fontSize: '48px' }}>🎉</span>
            <h3 style={{ margin: '16px 0 8px 0', fontSize: '22px', fontWeight: '600' }}>Migration Flow Finished!</h3>
            <p className="muted-text" style={{ margin: '0 0 32px 0' }}>
              Your files have been validated and successfully imported to your Supabase tables.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '0 auto' }}>
              {importFiles.map(f => {
                const results = validationResults[f.id] || [];
                const failedList = failedRowsReport[f.id] || [];
                const successful = results.length - failedList.length;

                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{f.name}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Target: {f.targetType.toUpperCase()} • Preset: {f.preset.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--success)', fontWeight: '600', fontSize: '13px' }}>
                        {successful} Successful
                      </span>
                      {failedList.length > 0 && (
                        <>
                          <span style={{ color: 'var(--danger)', fontWeight: '600', fontSize: '13px' }}>
                            {failedList.length} Failed
                          </span>
                          <button 
                            className="action-button danger-btn"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => downloadFailedCSV(f.id, f.name)}
                          >
                            Get Error Report
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              className="action-button primary" 
              style={{ marginTop: '32px' }}
              onClick={() => {
                setStep(1);
                setImportFiles([]);
                setValidationResults({});
                setAuditLogs([]);
                setFailedRowsReport({});
              }}
            >
              Back to Migration Center
            </button>
          </div>
        </div>
      )}

      {generalError && (
        <div style={{ padding: '16px', background: '#FEE2E2', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', marginTop: '24px', fontWeight: '500' }}>
          ⚠️ {generalError}
        </div>
      )}
    </PageSection>
  );
}

export default DataMigration;
