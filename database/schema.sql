-- =============================================================================
-- Travel Agency Management System - PostgreSQL Schema (Step by Step)
-- Run: psql -d travel_agency -f database/schema.sql
-- Order matters: run steps sequentially.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Users (authentication & staff)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'staff'
    CHECK (role IN ('super_admin', 'admin', 'branch_admin', 'manager', 'staff')),
  is_blocked BOOLEAN DEFAULT FALSE,
  branch VARCHAR(100),
  branch_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- STEP 1b: Branches (multi-branch management)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  manager_name VARCHAR(255),
  gst_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);

ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- STEP 2: Customers & family (CRM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  passport VARCHAR(100),
  family_count INTEGER DEFAULT 0,
  notes TEXT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE TABLE IF NOT EXISTS customer_family (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relation VARCHAR(100),
  age INTEGER,
  mobile VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE customer_family ADD COLUMN IF NOT EXISTS mobile VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);

-- -----------------------------------------------------------------------------
-- STEP 3: Master data – Cities, Hotels, Vehicles, Activities, Guides
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(255) DEFAULT 'India',
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  address TEXT,
  contact VARCHAR(100),
  room_type VARCHAR(100),
  price DECIMAL(12,2),
  base_price DECIMAL(12,2),
  markup_price DECIMAL(12,2),
  month_prices JSONB,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist (for existing DBs)
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS room_type VARCHAR(100);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS markup_price DECIMAL(12,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS month_prices JSONB;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  capacity INTEGER,
  price DECIMAL(12,2),
  base_price DECIMAL(12,2),
  markup_price DECIMAL(12,2),
  month_prices JSONB,
  contact VARCHAR(100),
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS markup_price DECIMAL(12,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS month_prices JSONB;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS contact VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(12,2),
  markup_price DECIMAL(12,2),
  price DECIMAL(12,2),
  month_prices JSONB,
  contact VARCHAR(100),
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  image_url VARCHAR(500),
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS markup_price DECIMAL(12,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS month_prices JSONB;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact VARCHAR(100);

CREATE TABLE IF NOT EXISTS guides (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(50),
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_city ON vehicles(city_id);
CREATE INDEX IF NOT EXISTS idx_activities_city ON activities(city_id);

-- -----------------------------------------------------------------------------
-- STEP 4: Packages & day-wise itinerary
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  days INTEGER,
  duration_days INTEGER,
  location VARCHAR(255),
  image_url VARCHAR(500),
  city_ids INTEGER[] DEFAULT '{}',
  image_urls TEXT[] DEFAULT '{}',
  itinerary_pdf_url TEXT,
  default_hotel_id INTEGER REFERENCES hotels(id) ON DELETE SET NULL,
  default_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE packages ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS city_ids INTEGER[] DEFAULT '{}';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS default_hotel_id INTEGER REFERENCES hotels(id);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS default_vehicle_id INTEGER REFERENCES vehicles(id);

CREATE TABLE IF NOT EXISTS package_days (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  activities TEXT,
  hotel_id INTEGER REFERENCES hotels(id) ON DELETE SET NULL,
  meals TEXT,
  transport TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_package_days_package ON package_days(package_id);

-- -----------------------------------------------------------------------------
-- STEP 5: Bookings (package_id nullable for delete; ON DELETE SET NULL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  travel_start_date DATE,
  travel_end_date DATE,
  assigned_hotel_id INTEGER REFERENCES hotels(id) ON DELETE SET NULL,
  assigned_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_guide_id INTEGER REFERENCES guides(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry','quotation_sent','confirmed','ongoing','completed','cancelled')),
  total_amount DECIMAL(12,2) DEFAULT 0,
  internal_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
ALTER TABLE bookings ALTER COLUMN package_id DROP NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_package_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_start_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_end_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT;

CREATE TABLE IF NOT EXISTS booking_notes (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_package ON bookings(package_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_booking_notes_booking ON booking_notes(booking_id);

-- -----------------------------------------------------------------------------
-- STEP 6: Quotations & items (terms_text, prepared_by)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  valid_until DATE,
  discount DECIMAL(12,2) DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  terms_text TEXT,
  prepared_by VARCHAR(255),
  family_count INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'draft',
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE quotations ALTER COLUMN package_id DROP NOT NULL;
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_package_id_fkey;
ALTER TABLE quotations ADD CONSTRAINT quotations_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms_text TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(255);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS family_count INTEGER DEFAULT 1;
ALTER TABLE quotations ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_customer_id_fkey;
ALTER TABLE quotations ADD CONSTRAINT quotations_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- -----------------------------------------------------------------------------
-- STEP 7: Booking payments (legacy)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  mode VARCHAR(50) NOT NULL CHECK (mode IN ('cash','upi','bank','card')),
  reference VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- -----------------------------------------------------------------------------
-- STEP 8: Invoices, invoice items, invoice payments (terms_text, company_gst)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  discount_type VARCHAR(20) DEFAULT 'flat',
  tax_percent DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  service_charges DECIMAL(12,2) DEFAULT 0,
  round_off DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft','issued','partially_paid','paid','overdue','cancelled')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  place_of_supply VARCHAR(100),
  billing_address TEXT,
  customer_gst VARCHAR(50),
  travel_destination VARCHAR(255),
  travel_start_date DATE,
  travel_end_date DATE,
  adults INTEGER DEFAULT 0,
  children INTEGER DEFAULT 0,
  package_name VARCHAR(255),
  hotel_category VARCHAR(100),
  vehicle_type VARCHAR(100),
  terms_text TEXT,
  company_gst VARCHAR(50),
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_text TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_gst VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(500),
  quantity DECIMAL(10,2) DEFAULT 1,
  rate DECIMAL(12,2) DEFAULT 0,
  amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  mode VARCHAR(50) NOT NULL CHECK (mode IN ('cash','upi','bank','card')),
  reference VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- -----------------------------------------------------------------------------
-- STEP 9: Documents, staff performance, company settings, activity logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_performance (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default company settings (ignore if key exists)
INSERT INTO company_settings (key, value) VALUES
  ('company_name',    'Vision Travel Hub'),
  ('company_address', '1234 Street, City, State, Zip Code'),
  ('company_phone',   '123-123-1234'),
  ('company_email',   'yourcompany@email.com'),
  ('company_gst',     'GST Number'),
  ('company_website', ''),
  ('bank_name',       'Your Bank Name'),
  ('bank_account',    '000000000000'),
  ('bank_ifsc',       'BANK0000000'),
  ('bank_upi',        'yourcompany@upi'),
  ('bank_branch',     'Main Branch'),
  ('upi_name',        ''),
  ('upi_qr_path',     '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_staff ON staff_performance(staff_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);

-- -----------------------------------------------------------------------------
-- STEP 10: Default admin user (optional; server also creates on startup)
-- Use bcrypt hash for 'admin123' – replace if you use a different method.
-- -----------------------------------------------------------------------------
-- INSERT INTO users (name, email, password, role) VALUES
--   ('Admin', 'admin@travel.com', '$2a$10$...', 'admin')
-- ON CONFLICT (email) DO NOTHING;
-- (Server creates this automatically; skip or run after first deploy.)

-- End of schema
