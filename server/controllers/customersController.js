import pool from '../config/db.js';

function resolveBranchId(req) {
  if (req.query.branch_id != null && String(req.query.branch_id) === 'all') return null;
  const branch_id = req.query.branch_id;
  if (branch_id != null && String(branch_id) !== '') {
    const parsed = parseInt(branch_id, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return req.branchId ?? null;
}

export const list = async (req, res) => {
  try {
    const { search, page = 1, limit = 20, branch_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const branchId = resolveBranchId(req);
    let where = '';
    const params = [];
    if (branchId && Number.isFinite(branchId)) {
      params.push(branchId);
      where = `WHERE c.branch_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      where += where ? ' AND ' : 'WHERE ';
      where += `(name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 2} OR mobile ILIKE $${params.length + 3})`;
    }
    const result = await pool.query(
      `SELECT c.*, b.name as branch_name
       FROM customers c
       LEFT JOIN branches b ON c.branch_id = b.id
       ${where}
       ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*)
       FROM customers c
       ${where}`,
      params
    );
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const cust = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (cust.rows.length === 0) return res.status(404).json({ message: 'Customer not found.' });
    const family = await pool.query('SELECT * FROM customer_family WHERE customer_id = $1 ORDER BY id', [id]);
    res.json({ ...cust.rows[0], family: family.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, mobile, email, address, passport, family_count, notes, branch_id } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    const bid = isElevated ? (branch_id ?? req.branchId ?? null) : (req.branchId ?? null);
    const result = await pool.query(
      `INSERT INTO customers (name, mobile, email, address, passport, family_count, notes, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, mobile || null, email || null, address || null, passport || null, family_count ?? 0, notes || null, bid]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, address, passport, family_count, notes, branch_id } = req.body;
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    const incomingBranchId = isElevated ? (branch_id ?? null) : null;
    const result = await pool.query(
      `UPDATE customers SET name = COALESCE($1, name), mobile = $2, email = $3, address = $4, passport = $5,
       family_count = COALESCE($6, family_count), notes = $7, branch_id = COALESCE($8, branch_id), updated_at = NOW() WHERE id = $9 RETURNING *`,
      [name, mobile, email, address, passport, family_count, notes, incomingBranchId, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Customer not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Customer not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addFamily = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, relation, mobile } = req.body;
    if (!name) return res.status(400).json({ message: 'Family member name is required.' });
    const result = await pool.query(
      'INSERT INTO customer_family (customer_id, name, relation, mobile) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, relation || null, mobile || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removeFamily = async (req, res) => {
  try {
    const { id, fid } = req.params;
    const result = await pool.query('DELETE FROM customer_family WHERE id = $1 AND customer_id = $2 RETURNING id', [fid, id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Replace all family members for a customer with the provided array
export const setFamily = async (req, res) => {
  try {
    const { id } = req.params;
    const { members } = req.body;
    const rows = Array.isArray(members) ? members : [];
    await pool.query('DELETE FROM customer_family WHERE customer_id = $1', [id]);
    for (const m of rows) {
      if (!m.name || !m.name.trim()) continue;
      await pool.query(
        'INSERT INTO customer_family (customer_id, name, relation, mobile) VALUES ($1, $2, $3, $4)',
        [id, m.name.trim(), m.relation || null, m.mobile || null]
      );
    }
    const family = await pool.query('SELECT * FROM customer_family WHERE customer_id = $1 ORDER BY id', [id]);
    res.json(family.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
