import pool from '../config/db.js';

const tableColumns = {
  cities: ['name', 'country'],
  hotels: ['name', 'city_id', 'address', 'contact', 'room_type', 'extra_adult_price', 'price', 'base_price', 'markup_price', 'month_prices'],
  vehicles: ['name', 'type', 'capacity', 'price', 'base_price', 'markup_price', 'month_prices', 'contact', 'city_id'],
  activities: ['name', 'description', 'base_price', 'markup_price', 'price', 'month_prices', 'contact', 'city_id', 'image_url'],
};

async function list(req, res, table) {
  try {
    const branchId =
      req.query.branch_id && String(req.query.branch_id) !== 'all'
        ? parseInt(req.query.branch_id, 10)
        : (req.branchId ?? null);
    const stateFilter = table === 'cities' && req.query.state
      ? String(req.query.state).trim()
      : '';
    const orderBy = table === 'cities' ? 'ORDER BY COALESCE(t.country, \'\'), t.name, t.id' : 'ORDER BY t.id';
    const runQuery = async (useBranchScope) => {
      const filters = [];
      const params = [];
      if (useBranchScope && branchId && Number.isFinite(branchId)) {
        filters.push(`(t.branch_id = $${params.length + 1} OR t.branch_id IS NULL)`);
        params.push(branchId);
      }
      if (stateFilter) {
        filters.push(`LOWER(COALESCE(t.country, '')) = LOWER($${params.length + 1})`);
        params.push(stateFilter);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return pool.query(
        `SELECT t.*, b.name as branch_name
         FROM ${table} t
         LEFT JOIN branches b ON t.branch_id = b.id
         ${where}
         ${orderBy}`,
        params
      );
    };

    let result = await runQuery(true);
    // Fallback: if scoped list is empty, return global/all read list.
    if (branchId && Number.isFinite(branchId) && result.rows.length === 0) {
      result = await runQuery(false);
    }
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
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    const bid = isElevated ? (body.branch_id ?? req.branchId ?? null) : (req.branchId ?? null);
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

async function optionalTxQuery(client, sql, params = []) {
  const sp = `sp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  await client.query(`SAVEPOINT ${sp}`);
  try {
    await client.query(sql, params);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
  } catch {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
  }
}

async function remove(req, res, table) {
  let client;
  try {
    const { id } = req.params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) return res.status(400).json({ message: 'Invalid id.' });

    client = await pool.connect();
    await client.query('BEGIN');

    // For older databases where some FK constraints are still RESTRICT/NO ACTION,
    // detach dependent records manually before deleting.
    if (table === 'cities') {
      await client.query('UPDATE hotels SET city_id = NULL WHERE city_id = $1', [itemId]);
      await client.query('UPDATE vehicles SET city_id = NULL WHERE city_id = $1', [itemId]);
      await client.query('UPDATE activities SET city_id = NULL WHERE city_id = $1', [itemId]);
      await optionalTxQuery(client, 'UPDATE itinerary_template_days SET city_id = NULL WHERE city_id = $1', [itemId]);
      await optionalTxQuery(client, 'UPDATE itinerary_templates SET state_id = NULL WHERE state_id = $1', [itemId]);
      await optionalTxQuery(client, 'UPDATE packages SET city_ids = array_remove(city_ids, $1) WHERE city_ids @> ARRAY[$1]::INTEGER[]', [itemId]);
    }

    if (table === 'hotels') {
      await optionalTxQuery(client, 'UPDATE packages SET default_hotel_id = NULL WHERE default_hotel_id = $1', [itemId]);
      await optionalTxQuery(client, 'UPDATE bookings SET assigned_hotel_id = NULL WHERE assigned_hotel_id = $1', [itemId]);
      await optionalTxQuery(client, 'UPDATE bookings_days SET hotel_id = NULL WHERE hotel_id = $1', [itemId]);
    }

    if (table === 'vehicles') {
      await optionalTxQuery(client, 'UPDATE packages SET default_vehicle_id = NULL WHERE default_vehicle_id = $1', [itemId]);
      await optionalTxQuery(client, 'UPDATE bookings SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = $1', [itemId]);
    }

    const result = await client.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [itemId]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });

    await client.query('COMMIT');
    res.json({ message: 'Deleted.' });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    if (err?.code === '23503') {
      return res.status(409).json({
        message: `Cannot delete this ${table.slice(0, -1)} because it is used in other records.`,
        detail: err.detail || null,
      });
    }
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (client) client.release();
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
