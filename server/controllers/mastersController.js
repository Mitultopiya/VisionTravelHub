import pool from '../config/db.js';

const tableColumns = {
  cities: ['name', 'country'],
  hotels: ['name', 'city_id', 'address', 'contact', 'room_type', 'price', 'base_price', 'markup_price', 'month_prices'],
  vehicles: ['name', 'type', 'capacity', 'price', 'base_price', 'markup_price', 'month_prices', 'contact', 'city_id'],
  activities: ['name', 'description', 'base_price', 'markup_price', 'price', 'month_prices', 'contact', 'city_id', 'image_url'],
};

async function list(req, res, table) {
  try {
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : (req.branchId ?? null);
    let where = '';
    const params = [];
    if (branchId) {
      where = 'WHERE branch_id = $1';
      params.push(branchId);
    }
    const result = await pool.query(`SELECT * FROM ${table} ${where} ORDER BY id`, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

async function create(req, res, table) {
  try {
    const baseCols = tableColumns[table];
    const cols = [...baseCols, 'branch_id'];
    const body = req.body;
    const bid = body.branch_id ?? req.branchId ?? null;
    const values = cols.map((c) => (c === 'branch_id' ? bid : (body[c] ?? null)));
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

async function update(req, res, table) {
  try {
    const { id } = req.params;
    const cols = tableColumns[table];
    const body = req.body;
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const values = cols.map((c) => body[c] !== undefined ? body[c] : null);
    values.push(id);
    const result = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

async function remove(req, res, table) {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

export const listCities = (req, res) => list(req, res, 'cities');
export const createCity = (req, res) => create(req, res, 'cities');
export const updateCity = (req, res) => update(req, res, 'cities');
export const removeCity = (req, res) => remove(req, res, 'cities');

export const listHotels = (req, res) => list(req, res, 'hotels');
export const createHotel = (req, res) => create(req, res, 'hotels');
export const updateHotel = (req, res) => update(req, res, 'hotels');
export const removeHotel = (req, res) => remove(req, res, 'hotels');

export const listVehicles = (req, res) => list(req, res, 'vehicles');
export const createVehicle = (req, res) => create(req, res, 'vehicles');
export const updateVehicle = (req, res) => update(req, res, 'vehicles');
export const removeVehicle = (req, res) => remove(req, res, 'vehicles');

export const listActivities = (req, res) => list(req, res, 'activities');
export const createActivity = (req, res) => create(req, res, 'activities');
export const updateActivity = (req, res) => update(req, res, 'activities');
export const removeActivity = (req, res) => remove(req, res, 'activities');

export const uploadFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const folder = req.query.folder || 'activities';
    const url = `/uploads/${folder}/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
