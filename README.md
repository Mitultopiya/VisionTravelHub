# Travel Agency Management System (Enterprise)

Full-stack ERP-style travel agency application with CRM, package builder, quotations, invoices, payment slips, company settings, staff management, and reports with charts.

---

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, React Router, Axios, React Icons, Recharts
- **Backend:** Node.js, Express.js, PostgreSQL, JWT, bcrypt, Multer, pdf-lib
- **Roles:** Super Admin, Admin, Branch Admin, Manager, Staff (login only; no signup; admin creates users)

---

## Default Admin

- **Email:** admin@travel.com  
- **Password:** admin123  
- Created automatically on first server start.

---

## Prerequisites

- Node.js 18+
- PostgreSQL

---

## Database Setup

1. Create database:
   ```bash
   createdb travel_agency
   ```

2. Run schema (step-by-step, in order):
   ```bash
   psql -d travel_agency -f database/schema.sql
   ```
   Or let the server create/alter tables on startup via `server/config/initDb.js`.

3. Ensure `.env` in `server/` has correct `DATABASE_URL` (or `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

---

## Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env: PORT, JWT_SECRET, DATABASE_URL or DB_* vars
npm start
```

Server runs at http://localhost:5000. Tables are created/updated automatically; default admin is seeded if missing.

---

## Frontend Setup

```bash
cd client
npm install
# Optional: set VITE_API_URL in .env (default http://localhost:5000/api)
npm run dev
```

Open http://localhost:5173.

---

## Core Modules & Features

### 1. Dashboard
- Branch selector (Ahmedabad, Baroda, Junagadh, Rajkot, etc.) at the top. The selected branch is remembered and applied across Dashboard, Settings, Customers, Invoices, Payment Slips, Master data, Staff, and Reports.
- Summary cards: **Total Customers**, **Total Revenue**, **Pending Payments**, **Completed Payments** (per branch)
- Payments Overview bar chart (Paid vs Pending invoices) and other analytics

### 2. Customer CRM
- Add / Edit / View customers (name, mobile, email, address, passport, family count, notes)
- Family members, travel history, search & filters
- **Under Customers:** Quotations, Invoice, Payment Slip (dropdown navigation)

### 3. Package Builder
- Create packages: name, description, price, duration, **multi-city** (city_ids), **default hotel**, **default vehicle**
- Day-wise itinerary (activities, hotel, meals, transport, notes)
- **Image upload** for packages (no PDF upload)
- Package deletion: bookings/quotations `package_id` set to NULL before delete

### 4. Master Data (Preferred Items)
- **Cities** – CRUD, **branch-specific** (only visible/usable in the selected branch)
- **Hotels** – CRUD with **room type**, **price**, **city**, **branch-specific**
- **Vehicles** – CRUD with **price**, **city**, **branch-specific**
- **Activities** – CRUD with **image upload**, **branch-specific**
- Guides removed from scope

### 5. Booking Management
- Select customer, package, travel dates; assign hotel, vehicle, staff
- Status: inquiry → quotation_sent → confirmed → ongoing → completed / cancelled
- Internal notes, documents

### 6. Quotations
- New Quotation: customer, package (optional), **valid until**, **Terms & Conditions** (manual, one point per line)
- **Package / Hotel / Vehicle** dropdowns: when package selected, defaults auto-fill; **Hotel** and **Vehicle** are **manual select** (city-wise filtered when package has cities)
- Cost breakdown: Package, Hotel, Vehicle rows editable; add/remove rows; discount, tax %, grand total
- **Prepared by:** automatically set to **logged-in user name** when quotation is created (stored in DB, shown in View, PDF, print)
- Download PDF, Print; quotation PDF uses company settings and full T&C with word-wrap

### 7. Invoices
- Create/Edit invoice: customer, dates, items, discount, tax, **terms_text**, **company_gst**
- Add payments (amount, mode, reference); track paid/due
- **Download PDF** – layout aligned with quotation style; Bank Details, GST; no blank Rs.0.00 rows

### 8. Payment Slips (under Customers)
- **Customer-wise** list: expand per customer to see all payments
- Columns: #, Invoice No., Amount, Mode, Date, Actions (Receipt, PDF, Delete)
- **Receipt modal:** company details, amount, GST; **Print** (same structure as PDF); **Download PDF**
- Reference column removed from list and receipt
- Company details and GST from **Company Settings** (live)

### 9. Company Settings & Branch Settings (Admin)
- **Company information:** name, address, phone, email, GST, website
- **Bank details:** bank name, account number, IFSC, UPI, branch
- **Payment Settings:** UPI Name, UPI ID, **UPI QR Code upload** (image stored in `/uploads/payment`), used in invoice/payment-slip PDFs
- **Branch Management:** create/edit/delete branches (Name, Code, Address, City, State, Phone, Email, Manager Name, GST Number)
- Settings are **branch-aware**: choose a branch in Settings and only that branch’s overrides (bank/UPI/QR) are edited; global defaults remain in `company_settings`.
- All settings are used in **all PDFs** (quotation, invoice, payment slip) and receipt print.

### 10. Staff Management
- Add staff: name, email, password, **assigned branch** (selected from real branches); role is **staff** (no role dropdown)
- Staff listing filtered by current branch; staff login is scoped to their assigned `branch_id` (branch admins/staff only see their branch’s data)
- List: Name, Email, Branch, Status, Actions (Edit, **Reset Password**, Block, Delete)
- **Reset Password:** admin-only; modal to set new password for selected staff
- Delete staff supported (API fixed for 404)

### 11. Reports & Analytics
- All reports respect the **selected branch** (branch-aware dashboard data).
- **Overview:** KPI cards (customers, revenue, collected, pending); invoice status pills; **monthly revenue chart** (last 6 months); **donut charts** (collections by mode, invoice status); quotation stats
- **Revenue:** date filter; bar chart; revenue table with totals
- **Pending Payments:** summary cards; bar chart (due vs collected); table with overdue badges, progress, totals
- **Staff:** performance bar chart; staff table with completed/cancelled counts and performance %
- **Refresh** button; real-time data; mobile-responsive layout

### 12. Documents
- Upload and link files to entities (e.g. customer, booking)

### 13. PDFs
- **Quotation PDF** – company logo, quote no., dates, **Prepared by**, customer, items, T&C (full text, word-wrapped), summary, bank details
- **Invoice PDF** – same style; invoice no., GST, **combined Bank & UPI box with QR image**, no blank item rows
- **Payment slip PDF** – receipt layout; company + GST; amount received; UPI QR + payment card

---

## Role Permissions

- **Super Admin:** All branches, all features
- **Admin:** All branches, user management, company & branch settings; staff reset password
- **Branch Admin:** Access **only their branch**; manage staff and data within that branch
- **Manager:** Customers, packages, bookings, quotations, invoices, payment slips, reports, staff (no delete staff)
- **Staff:** View assigned bookings, update status, add notes (no master data, no settings)

---

## API Overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login` |
| Users | `GET/POST/DELETE /api/users`, `PATCH /api/users/:id/block` |
| Customers | `GET/POST/PUT/DELETE /api/customers`, family sub-routes |
| Masters | `GET/POST/PUT/DELETE /api/masters/cities|hotels|vehicles|activities` |
| Packages | `GET/POST/PUT/DELETE /api/packages`, `POST /api/packages/upload`, `POST /api/packages/:id/days` |
| Bookings | `GET/POST/PUT /api/bookings`, `POST /api/bookings/:id/notes` |
| Quotations | `GET/POST/PUT/DELETE /api/quotations`, `POST /api/quotations/:id/convert-booking` |
| Invoices | `GET/POST/PUT/DELETE /api/invoices`, `GET /api/invoices/next-number`, `GET /api/invoices/all-payments`, `POST /api/invoices/:id/payments`, `DELETE /api/invoices/:id/payments/:pid` |
| Payments | `GET /api/payments/booking/:id`, `POST/DELETE /api/payments` |
| Staff | `GET/POST/PUT/DELETE /api/staff`, `PATCH /api/staff/:id/block`, `PATCH /api/staff/:id/reset-password`, `GET /api/staff/:id/performance` |
| Reports | `GET /api/reports/dashboard|revenue|pending-payments|staff-performance` |
| Settings | `GET/PUT /api/settings` |
| PDF | `GET /api/pdf/itinerary/:id`, `GET /api/pdf/invoice/:id`, `GET /api/pdf/invoice-doc/:id`, `GET /api/pdf/quotation/:id`, `GET /api/pdf/payment-slip/:id` |
| Documents | `GET/POST/DELETE /api/documents` (query: entity_type, entity_id) |

Use header: `Authorization: Bearer <token>`. Base URL: `http://localhost:5000/api`.

---

## Project Structure

```
Travel-Agency/
├── client/src/
│   ├── components/       # Sidebar, Header, Modal, Button, Input, Loading, etc.
│   ├── context/          # ToastContext
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Admin/         # Dashboard, Customers, Quotations, Invoices, PaymentSlips,
│   │   │                   # Packages, PackageBuilder, Bookings, Reports, Staff, Settings
│   │   │   └── Masters/    # Cities, Hotels, Vehicles, Activities
│   │   └── Staff/         # Dashboard, MyBookings, BookingDetails
│   ├── services/api.js
│   └── utils/auth.js
├── server/
│   ├── config/           # db.js, initDb.js
│   ├── controllers/      # auth, users, customers, masters, packages, bookings,
│   │                      # quotations, invoices, payments, documents, staff, reports, pdf, settings
│   ├── middleware/       # auth.js (JWT, roles), upload.js (Multer)
│   ├── routes/
│   ├── services/         # pdfService.js (quotation, invoice, payment slip PDFs)
│   ├── uploads/
│   └── server.js
├── database/
│   └── schema.sql        # Step-by-step PostgreSQL schema
└── README.md
```

---

## Security

- Passwords hashed with bcrypt
- JWT authentication; role-based middleware (adminOnly, adminOrManager, anyAuth)
- Store secrets in `.env`; do not commit `.env`

---

## UI Notes

- White theme with teal/cyan accents; React Icons throughout
- Sidebar: Dashboard, Customers (with Quotations, Invoice, Payment Slip), Packages, Package Builder, Preferred Items (Cities, Hotels, Vehicles, Activities), Reports, Staff, Settings
- Tables: custom styled (teal gradient header, hover, pill actions); mobile-responsive
- Login: corporate-style with logo and brand colours
