# 📒 KhataPe — GST/VAT Billing, Invoicing & Inventory Management System

> **A modern, dark-themed React & Supabase web application for small businesses, retail merchants, and accountants.**

---

## 🌟 Key Features

| Category | Features |
|---|---|
| 📄 **Invoicing & Billing** | GST/VAT compliance, Sales Invoices, Quotations, Estimates, Proforma Invoices, Delivery Challans, Credit & Debit Notes, Purchase Bills |
| 📦 **Inventory Management** | Multi-warehouse support, Auto-stock deduction/addition, Min-stock alerts, Product Categories |
| 🔍 **POS & Barcode Scanner** | Camera scan & USB hardware barcode scanner support with offline billing queue |
| 👥 **Team & Role Access** | Granular permissions (Admin, Accountant, Viewer, Custom Roles) with tenant isolation |
| 📶 **Offline & PWA** | Local caching of customer & product directories, background queue for offline invoices |
| 📊 **Accounting & Reports** | Profit & Loss, GST/VAT Summaries, Cashbook ledger, Expense tracking, Customer Outstandings |
| 💬 **Messaging & Exports** | 1-click WhatsApp, SMS & Copy billing summaries, PDF print & CSV data exports |

---

## 🚀 Quick Setup Instructions

### 1. Database Setup (Supabase)
1. Sign up for a free account at [Supabase.com](https://supabase.com).
2. Create a new project and wait for setup to finish.
3. Open the **SQL Editor** in your Supabase Dashboard.
4. Copy the contents of [`schema.sql`](./schema.sql), paste into SQL Editor, and click **RUN**.

### 2. Environment Configuration
Duplicate `.env.example` to create `.env`:
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Locally
```bash
# Install dependencies
npm install

# Start local server
npm start
```
Your application will open at `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
```
Upload the contents of the `build/` directory to Vercel, Netlify, or any web server.

---

## 📂 Project Architecture

```
billbook/
├── .env.example                ← Environment configuration template
├── DOCUMENTATION.html          ← Complete HTML documentation guide
├── schema.sql                  ← Master database SQL schema
├── public/                     ← Static assets & index.html
└── src/
    ├── App.js                  ← Main Router & App Shell
    ├── components/             ← Reusable UI components & POS scanner
    ├── lib/                    ← Business context, Role context & Supabase API layer
    ├── pages/                  ← Application pages (Invoices, Customers, Reports, Settings)
    └── index.css               ← Dark-theme & Design tokens
```

---

## 📄 License & Support

Created for sale on CodeCanyon. Refer to Envato license terms for Regular and Extended Licenses.
