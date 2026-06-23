# 📒 myBillBook Clone — Complete Setup Guide

## ✅ Features (100% Complete)

| Feature | Status |
|---|---|
| Multi-user Login / Signup | ✅ |
| Dashboard with charts & alerts | ✅ |
| Sales Invoices (GST) | ✅ |
| Purchase Orders | ✅ |
| Expense Tracking | ✅ |
| Customer Management | ✅ |
| Supplier Management | ✅ |
| Inventory with stock auto-update | ✅ |
| Record Payments (partial/full) | ✅ |
| Payment History | ✅ |
| Invoice Print / Save PDF | ✅ |
| Email Invoice Sharing | ✅ |
| CSV Export for invoices/customers/products/expenses | ✅ |
| Dashboard overdue alerts | ✅ |
| Business Logo support | ✅ |
| Reports + GST Summary | ✅ |
| Business Profile Settings | ✅ |
| Bank details on invoices | ✅ |
| Net Profit calculation | ✅ |
| Row Level Security (each user's data private) | ✅ |

---

## STEP 1 — Supabase Account (Free)

1. Go to https://supabase.com → Sign up (free)
2. Click **"New Project"** → name it, set password, region = South Asia
3. Wait ~2 minutes for setup

---

## STEP 2 — Run the SQL

1. Supabase Dashboard → **SQL Editor** → **New Query**
2. Open `supabase_schema.sql` from this folder
3. Copy ALL content → Paste → Click **Run**
4. You should see green "Success" ✅

---

## STEP 3 — Add Your Supabase Keys

Open the `.env` file in this folder and replace:
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these at: Supabase → Settings (⚙) → API

---

## STEP 4 — Run the App

```bash
npm install
npm start
```

Opens at → http://localhost:3000

---

## STEP 5 — Disable Email Confirmation (For easy testing)

Supabase → Authentication → Providers → Email → Turn OFF "Confirm email" → Save

---

## STEP 6 — Deploy Free (Optional)

```bash
npm install -g vercel
vercel
```

Share the link with anyone!

---

## File Structure

```
billbook/
├── .env                        ← ⚠️ Put Supabase keys here
├── package.json
├── supabase_schema.sql         ← ⚠️ Run this in Supabase SQL Editor
├── public/
│   └── index.html
└── src/
    ├── index.js
    ├── App.js                  ← All screens (Dashboard, Sales, etc.)
    ├── lib/
    │   ├── supabase.js         ← Supabase client
    │   ├── AuthContext.js      ← Login/Logout/Session
    │   └── db.js               ← All database functions
    └── pages/
        └── AuthPage.js         ← Login & Signup page
```
