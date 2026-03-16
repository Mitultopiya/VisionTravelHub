import pool from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create all tables and run migrations for enterprise schema
 */
export async function initDb() {
  const client = await pool.connect();
  try {
    // Migrate users: add is_blocked, branch, allow admin|manager|staff
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
    `).catch(() => {});
    await client.query(`UPDATE users SET role = 'staff' WHERE role = 'user';`).catch(() => {});
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`).catch(() => {});
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'manager', 'staff'));
    `).catch(() => {});

    // Branches (multi-branch management)
    await client.query(`
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
      )
    `);

    // New tables in dependency order
    const tables = [
      `CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        passport VARCHAR(100),
        family_count INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS customer_family (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        relation VARCHAR(100),
        age INTEGER,
        mobile VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(255) DEFAULT 'India',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS hotels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        address TEXT,
        contact VARCHAR(100),
        room_type VARCHAR(100),
        price DECIMAL(12,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        capacity INTEGER,
        price DECIMAL(12,2),
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        image_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS guides (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(50),
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const sql of tables) {
      await client.query(sql);
    }

    // Customer family: add mobile on older databases
    await client.query(`
      ALTER TABLE customer_family ADD COLUMN IF NOT EXISTS mobile VARCHAR(50);
    `).catch(() => {});

    // Hotels: ensure new columns exist on older databases
    await client.query(`
      ALTER TABLE hotels ADD COLUMN IF NOT EXISTS room_type VARCHAR(100);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE hotels ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
    `).catch(() => {});

    // Vehicles: ensure city_id exists on older databases
    await client.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
    `).catch(() => {});

    // Activities: image_url for activity image upload
    await client.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);`).catch(() => {});

    // Masters: branch_id + hotel/vehicle/activity pricing for cities / hotels / vehicles / activities
    await client.query(`ALTER TABLE cities     ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE hotels     ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE hotels     ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2);`).catch(() => {});
    await client.query(`ALTER TABLE hotels     ADD COLUMN IF NOT EXISTS markup_price DECIMAL(12,2);`).catch(() => {});
    await client.query(`ALTER TABLE hotels     ADD COLUMN IF NOT EXISTS month_prices JSONB;`).catch(() => {});
    await client.query(`ALTER TABLE vehicles   ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE vehicles   ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2);`).catch(() => {});
    await client.query(`ALTER TABLE vehicles   ADD COLUMN IF NOT EXISTS markup_price DECIMAL(12,2);`).catch(() => {});
    await client.query(`ALTER TABLE vehicles   ADD COLUMN IF NOT EXISTS month_prices JSONB;`).catch(() => {});
    await client.query(`ALTER TABLE vehicles   ADD COLUMN IF NOT EXISTS contact VARCHAR(100);`).catch(() => {});
    await client.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2);`).catch(() => {});
    await client.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS markup_price DECIMAL(12,2);`).catch(() => {});
    await client.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS month_prices JSONB;`).catch(() => {});
    await client.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact VARCHAR(100);`).catch(() => {});

    // Packages: add new columns if table exists (old structure)
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `).catch(() => {});
    await client.query(`
      UPDATE packages SET name = title WHERE name IS NULL AND title IS NOT NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_days INTEGER;
    `).catch(() => {});
    await client.query(`
      UPDATE packages SET duration_days = days WHERE duration_days IS NULL AND days IS NOT NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS city_ids INTEGER[] DEFAULT '{}';
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS itinerary_pdf_url TEXT;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS default_hotel_id INTEGER REFERENCES hotels(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS default_vehicle_id INTEGER REFERENCES vehicles(id);
    `).catch(() => {});

    await client.query(`
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
      )
    `);

    // Bookings: ensure we have customers first, then alter or create bookings
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ALTER COLUMN package_id DROP NOT NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_package_id_fkey;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD CONSTRAINT bookings_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_start_date DATE;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_end_date DATE;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_hotel_id INTEGER REFERENCES hotels(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_vehicle_id INTEGER REFERENCES vehicles(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES users(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_guide_id INTEGER REFERENCES guides(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT;
    `).catch(() => {});
    await client.query(`UPDATE bookings SET status = 'inquiry' WHERE status = 'pending';`).catch(() => {});
    await client.query(`
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('inquiry','quotation_sent','confirmed','ongoing','completed','cancelled'));
    `).catch(() => {});

    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_notes (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
        valid_until DATE,
        discount DECIMAL(12,2) DEFAULT 0,
        tax_percent DECIMAL(5,2) DEFAULT 0,
        terms_text TEXT,
        prepared_by VARCHAR(255),
        status VARCHAR(50) DEFAULT 'draft',
        total DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE quotations ALTER COLUMN customer_id DROP NOT NULL;`).catch(() => {});
    await client.query(`ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_customer_id_fkey;`).catch(() => {});
    await client.query(`ALTER TABLE quotations ADD CONSTRAINT quotations_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;`).catch(() => {});

    // Allow deleting customers referenced by bookings / invoices: set customer_id to NULL instead of RESTRICT
    await client.query(`ALTER TABLE bookings ALTER COLUMN customer_id DROP NOT NULL;`).catch(() => {});
    await client.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;`).catch(() => {});
    await client.query(`ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;`).catch(() => {});
    await client.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`
      ALTER TABLE quotations ALTER COLUMN package_id DROP NOT NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_package_id_fkey;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE quotations ADD CONSTRAINT quotations_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms_text TEXT;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(255);
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS family_count INTEGER DEFAULT 1;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_text TEXT;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_gst VARCHAR(50);
    `).catch(() => {});

    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        mode VARCHAR(50) NOT NULL CHECK (mode IN ('cash','upi','bank','card')),
        reference VARCHAR(255),
        paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
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
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','overdue','cancelled')),
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description VARCHAR(500),
        quantity DECIMAL(10,2) DEFAULT 1,
        rate DECIMAL(12,2) DEFAULT 0,
        amount DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        mode VARCHAR(50) NOT NULL CHECK (mode IN ('cash','upi','bank','card')),
        reference VARCHAR(255),
        paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_performance (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        notes TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        period_start DATE,
        period_end DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS branch_settings (
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (branch_id, key)
      )
    `).catch(() => {});
    // Seed default company settings if not present
    const settingsSeed = [
      ['company_name',    'Vision Travel Hub'],
      ['company_address', '1234 Street, City, State, Zip Code'],
      ['company_phone',   '123-123-1234'],
      ['company_email',   'yourcompany@email.com'],
      ['company_gst',     'GST Number'],
      ['company_website', ''],
      ['bank_name',       'Your Bank Name'],
      ['bank_account',    '000000000000'],
      ['bank_ifsc',       'BANK0000000'],
      ['bank_upi',        'yourcompany@upi'],
      ['bank_branch',     'Main Branch'],
      ['upi_name',        ''],
      ['upi_qr_path',     ''],
    ];
    for (const [k, v] of settingsSeed) {
      await client.query(
        `INSERT INTO company_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [k, v]
      ).catch(() => {});
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Multi-branch: add branch_id to major tables and extend user roles
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`).catch(() => {});
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('super_admin', 'admin', 'branch_admin', 'manager', 'staff'));
    `).catch(() => {});
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`).catch(() => {});

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);').catch(() => {});

    // Seed default Ahmedabad branch if none exists
    await client.query(`
      INSERT INTO branches (name, code, address, city, state, phone, email, manager_name, gst_number, updated_at)
      SELECT 'Ahmedabad Branch', 'AHM', 'Ahmedabad Branch Address', 'Ahmedabad', 'Gujarat', '', '', '', '', CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1)
    `).catch(() => {});

    // Move all existing data to Ahmedabad branch (AHM)
    const ahm = await client.query(`SELECT id FROM branches WHERE code = 'AHM' OR name ILIKE '%ahmedabad%' ORDER BY id LIMIT 1`).catch(() => ({ rows: [] }));
    const ahmId = ahm.rows[0]?.id;
    if (ahmId) {
      // One-time migration: move ALL existing data to Ahmedabad branch
      const migKey = 'migrate_all_to_ahm_v2';
      const mig = await client.query(`SELECT value FROM company_settings WHERE key = $1`, [migKey]).catch(() => ({ rows: [] }));
      if (!mig.rows[0] || mig.rows[0].value !== 'done') {
        await client.query(`UPDATE customers  SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE bookings   SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE quotations SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE invoices   SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE users      SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE cities     SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE hotels     SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE vehicles   SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(`UPDATE activities SET branch_id = $1`, [ahmId]).catch(() => {});
        await client.query(
          `INSERT INTO company_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [migKey, 'done']
        ).catch(() => {});
      }
      // Safety: ensure any future NULL branch rows default to Ahmedabad
      await client.query(`UPDATE customers  SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE bookings   SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE quotations SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE invoices   SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE users      SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE cities     SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE hotels     SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE vehicles   SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
      await client.query(`UPDATE activities SET branch_id = $1 WHERE branch_id IS NULL`, [ahmId]).catch(() => {});
    }

    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_branch ON bookings(branch_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings(assigned_staff_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);').catch(() => {});
  } finally {
    client.release();
  }
}
