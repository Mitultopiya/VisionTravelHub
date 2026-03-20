import pool from '../config/db.js';

function resolveBranchId(req) {
  if (req.query.branch_id != null && String(req.query.branch_id) === 'all') return null;
  if (req.query.branch_id != null && String(req.query.branch_id) !== '') {
    const parsed = parseInt(req.query.branch_id, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return req.branchId ?? null;
}

function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  return pool
    .query(
      `SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [prefix + '%']
    )
    .then((r) => {
      const last = r.rows[0]?.invoice_number || '';
      const num = last ? parseInt(last.replace(prefix, ''), 10) + 1 : 1;
      return `${prefix}${String(num).padStart(4, '0')}`;
    });
}

export const list = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const where = branchId && Number.isFinite(branchId) ? ' WHERE i.branch_id = $1' : '';
    const params = branchId ? [branchId] : [];
    const result = await pool.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.mobile,
        b.name as branch_name,
        (SELECT COALESCE(SUM(ip.amount), 0) FROM invoice_payments ip WHERE ip.invoice_id = i.id) as paid_amount
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN branches b ON i.branch_id = b.id${where}
       ORDER BY i.created_at DESC`,
      params
    );
    const rows = result.rows.map((r) => {
      const total = Number(r.total || 0);
      const paid = Number(r.paid_amount || 0);
      let status = r.status;
      if (status === 'issued' && new Date(r.due_date) < new Date() && paid < total) status = 'overdue';
      if (status !== 'cancelled' && status !== 'paid' && paid >= total && total > 0) status = 'paid';
      return { ...r, paid_amount: paid, status };
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await pool.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.mobile, c.address as customer_address
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = $1`,
      [id]
    );
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
    const payments = await pool.query('SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY paid_at', [id]);
    const paid = payments.rows.reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = Number(inv.rows[0].total || 0);
    let status = inv.rows[0].status;
    if (status !== 'cancelled' && status !== 'paid' && paid >= total && total > 0) status = 'paid';
    else if (status === 'issued' && new Date(inv.rows[0].due_date) < new Date() && paid < total) status = 'overdue';
    res.json({
      ...inv.rows[0],
      items: items.rows,
      payments: payments.rows,
      paid_amount: paid,
      due_amount: Math.max(0, total - paid),
      status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const nextNumber = async (req, res) => {
  try {
    const num = await getNextInvoiceNumber();
    res.json({ invoice_number: num });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const {
      invoice_number,
      booking_id,
      customer_id,
      invoice_date,
      due_date,
      subtotal,
      discount,
      discount_type,
      tax_percent,
      tax_amount,
      service_charges,
      round_off,
      total,
      status,
      place_of_supply,
      billing_address,
      customer_gst,
      travel_destination,
      travel_start_date,
      travel_end_date,
      adults,
      children,
      package_name,
      hotel_category,
      vehicle_type,
      terms_text,
      company_gst,
      items,
      created_by,
      branch_id,
    } = req.body;
    if (!customer_id || !invoice_date || !due_date) {
      return res.status(400).json({ message: 'customer_id, invoice_date, due_date required.' });
    }
    const num = invoice_number || (await getNextInvoiceNumber());
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    const bid = isElevated ? (branch_id ?? req.branchId ?? null) : (req.branchId ?? null);
    const result = await pool.query(
      `INSERT INTO invoices (
        invoice_number, booking_id, customer_id, invoice_date, due_date,
        subtotal, discount, discount_type, tax_percent, tax_amount, service_charges, round_off, total,
        status, created_by, place_of_supply, billing_address, customer_gst,
        travel_destination, travel_start_date, travel_end_date, adults, children,
        package_name, hotel_category, vehicle_type, terms_text, company_gst, branch_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
      [
        num, booking_id || null, customer_id, invoice_date, due_date,
        Number(subtotal) || 0, Number(discount) || 0, discount_type || 'flat', Number(tax_percent) || 0, Number(tax_amount) || 0,
        Number(service_charges) || 0, Number(round_off) || 0, Number(total) || 0,
        status || 'draft', created_by || null, place_of_supply || null, billing_address || null, customer_gst || null,
        travel_destination || null, travel_start_date || null, travel_end_date || null, Number(adults) || 0, Number(children) || 0,
        package_name || null, hotel_category || null, vehicle_type || null, terms_text || null, company_gst || null, bid,
      ]
    );
    const invoice = result.rows[0];
    if (items && items.length) {
      for (const it of items) {
        await pool.query(
          'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES ($1,$2,$3,$4,$5)',
          [invoice.id, it.description || '', Number(it.quantity) || 0, Number(it.rate) || 0, Number(it.amount) || 0]
        );
      }
    }
    const full = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice.id]);
    const itemRows = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoice.id]);
    res.status(201).json({ ...full.rows[0], items: itemRows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    const {
      invoice_date,
      due_date,
      subtotal,
      discount,
      discount_type,
      tax_percent,
      tax_amount,
      service_charges,
      round_off,
      total,
      status,
      place_of_supply,
      billing_address,
      customer_gst,
      travel_destination,
      travel_start_date,
      travel_end_date,
      adults,
      children,
      package_name,
      hotel_category,
      vehicle_type,
      terms_text,
      company_gst,
      items,
      branch_id,
    } = req.body;
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    const incomingBranchId = isElevated ? (branch_id ?? null) : null;
    await pool.query(
      `UPDATE invoices SET
        invoice_date=COALESCE($1,invoice_date), due_date=COALESCE($2,due_date),
        subtotal=COALESCE($3,subtotal), discount=COALESCE($4,discount), discount_type=COALESCE($5,discount_type),
        tax_percent=COALESCE($6,tax_percent), tax_amount=COALESCE($7,tax_amount),
        service_charges=COALESCE($8,service_charges), round_off=COALESCE($9,round_off), total=COALESCE($10,total),
        status=COALESCE($11,status), place_of_supply=$12, billing_address=$13, customer_gst=$14,
        travel_destination=$15, travel_start_date=$16, travel_end_date=$17, adults=COALESCE($18,adults), children=COALESCE($19,children),
        package_name=$20, hotel_category=$21, vehicle_type=$22, terms_text=$23, company_gst=$24,
        branch_id=COALESCE($25, branch_id), updated_at=NOW()
       WHERE id=$26`,
      [
        invoice_date, due_date, subtotal, discount, discount_type, tax_percent, tax_amount,
        service_charges, round_off, total, status,
        place_of_supply || null, billing_address || null, customer_gst || null,
        travel_destination || null, travel_start_date || null, travel_end_date || null, adults, children,
        package_name || null, hotel_category || null, vehicle_type || null, terms_text || null, company_gst || null,
        incomingBranchId, id,
      ]
    );
    if (items) {
      await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
      for (const it of items) {
        await pool.query(
          'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES ($1,$2,$3,$4,$5)',
          [id, it.description || '', Number(it.quantity) || 0, Number(it.rate) || 0, Number(it.amount) || 0]
        );
      }
    }
    const inv = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    const itemRows = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
    res.json({ ...inv.rows[0], items: itemRows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Invoice not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const listAllPayments = async (req, res) => {
  try {
    const branchId =
      req.query.branch_id && String(req.query.branch_id) !== 'all'
        ? parseInt(req.query.branch_id, 10)
        : (req.branchId ?? null);
    const where = branchId && Number.isFinite(branchId) ? ' WHERE i.branch_id = $1' : '';
    const params = branchId ? [branchId] : [];
    const result = await pool.query(
      `SELECT ip.*, i.invoice_number, i.total as invoice_total,
              i.company_gst, i.customer_gst, i.place_of_supply,
              c.name as customer_name, c.mobile as customer_mobile
       FROM invoice_payments ip
       JOIN invoices i ON ip.invoice_id = i.id
       LEFT JOIN customers c ON i.customer_id = c.id${where}
       ORDER BY ip.paid_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removePayment = async (req, res) => {
  try {
    const { id, pid } = req.params;
    const result = await pool.query(
      'DELETE FROM invoice_payments WHERE id = $1 AND invoice_id = $2 RETURNING id',
      [pid, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Payment not found.' });
    res.json({ message: 'Payment deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, mode, reference } = req.body;
    const inv = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (!amount || !mode) return res.status(400).json({ message: 'amount and mode required.' });
    await pool.query(
      'INSERT INTO invoice_payments (invoice_id, amount, mode, reference) VALUES ($1,$2,$3,$4)',
      [id, Number(amount), mode, reference || null]
    );
    const payments = await pool.query('SELECT * FROM invoice_payments WHERE invoice_id = $1', [id]);
    const paid = payments.rows.reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = Number(inv.rows[0].total || 0);
    let status = inv.rows[0].status;
    if (paid >= total && total > 0) status = 'paid';
    else if (paid > 0) status = 'partially_paid';
    await pool.query('UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    const updated = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    res.status(201).json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
