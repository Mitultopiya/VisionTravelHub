import pool from '../config/db.js';

function parseBranchId(req) {
  // If user is branch-scoped (branch_admin/admin tied to a branch), never allow all-branch override.
  if (req.branchId) return req.branchId;

  if (req.query.branch_id && String(req.query.branch_id) !== 'all') {
    const n = Number(req.query.branch_id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function buildPlan(days = []) {
  const cleanDays = days.filter((d) => d?.city_name && Number(d?.night_count) > 0);
  const totalNights = cleanDays.reduce((sum, d) => sum + Number(d.night_count || 0), 0);
  const plan = `${cleanDays.map((d) => `${Number(d.night_count)}N ${d.city_name}`).join(' / ')} (${totalNights} Nights)`;
  return { totalNights, plan };
}

async function resolveStateName(input) {
  const direct = String(input?.state_name || input?.state || '').trim();
  if (direct) return direct;
  const stateId = Number(input?.state_id);
  if (!Number.isFinite(stateId) || stateId <= 0) return '';
  const city = await pool.query('SELECT country, name FROM cities WHERE id = $1 LIMIT 1', [stateId]);
  return String(city.rows[0]?.country || city.rows[0]?.name || '').trim();
}

async function getDaysMap(itineraryIds) {
  if (!itineraryIds.length) return new Map();
  const rows = await pool.query(
    `SELECT id, itinerary_id, day_number, city_id, city_name, night_count
     FROM itinerary_template_days
     WHERE itinerary_id = ANY($1::int[])
     ORDER BY itinerary_id, day_number, id`,
    [itineraryIds]
  );
  const map = new Map();
  for (const r of rows.rows) {
    if (!map.has(r.itinerary_id)) map.set(r.itinerary_id, []);
    map.get(r.itinerary_id).push(r);
  }
  return map;
}

export const list = async (req, res) => {
  try {
    const branchId = parseBranchId(req);
    const stateName = req.query.state_name ? String(req.query.state_name).trim() : '';
    const activeFilter = req.query.is_active !== undefined ? String(req.query.is_active) === 'true' : null;
    const runQuery = async (useBranchScope) => {
      const filters = [];
      const params = [];
      let idx = 1;
      if (useBranchScope && branchId) {
        filters.push(`(t.branch_id = $${idx++} OR t.branch_id IS NULL)`);
        params.push(branchId);
      }
      if (stateName) {
        filters.push(`LOWER(COALESCE(t.state_name, '')) = LOWER($${idx++})`);
        params.push(stateName);
      }
      if (activeFilter !== null) {
        filters.push(`t.is_active = $${idx++}`);
        params.push(activeFilter);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return pool.query(
        `SELECT t.*, b.name AS branch_name
         FROM itinerary_templates t
         LEFT JOIN branches b ON t.branch_id = b.id
         ${where}
         ORDER BY t.created_at DESC`,
        params
      );
    };

    let templates = await runQuery(true);
    if (branchId && templates.rows.length === 0) {
      templates = await runQuery(false);
    }

    const ids = templates.rows.map((r) => r.id);
    const daysMap = await getDaysMap(ids);
    const data = templates.rows.map((t) => {
      const days = daysMap.get(t.id) || [];
      const { plan } = buildPlan(days);
      return { ...t, days, plan };
    });
    res.json(data);
  } catch (err) {
    console.error('itineraryTemplate.list:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const listCities = async (req, res) => {
  try {
    const stateName = String(req.query.state_name || '').trim();
    if (!stateName) return res.json([]);
    const branchId = parseBranchId(req);
    const runQuery = async (useBranchScope) => {
      const params = [stateName];
      const branchFilter = useBranchScope && branchId ? 'AND (t.branch_id = $2 OR t.branch_id IS NULL)' : '';
      if (useBranchScope && branchId) params.push(branchId);
      return pool.query(
        `SELECT DISTINCT d.city_name
         FROM itinerary_template_days d
         INNER JOIN itinerary_templates t ON t.id = d.itinerary_id
         WHERE LOWER(COALESCE(t.state_name, '')) = LOWER($1)
         ${branchFilter}
         ORDER BY d.city_name`,
        params
      );
    };
    let result = await runQuery(true);
    if (branchId && result.rows.length === 0) {
      result = await runQuery(false);
    }
    res.json(result.rows.map((r) => ({ id: r.city_name, name: r.city_name })));
  } catch (err) {
    console.error('itineraryTemplate.listCities:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, branch_id, is_active = true, days = [] } = req.body || {};
    const stateName = await resolveStateName(req.body || {});
    if (!title || !stateName) return res.status(400).json({ message: 'Title and state are required.' });
    if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ message: 'At least one city row is required.' });

    const normalizedDays = days.map((d, i) => ({
      day_number: i + 1,
      city_id: d.city_id ? Number(d.city_id) : null,
      city_name: String(d.city_name || '').trim(),
      night_count: Number(d.night_count || 0),
    }));
    if (normalizedDays.some((d) => !d.city_name || !Number.isFinite(d.night_count) || d.night_count <= 0)) {
      return res.status(400).json({ message: 'Each row must have city and nights > 0.' });
    }

    const { totalNights, plan } = buildPlan(normalizedDays);
    const effectiveBranchId = branch_id ? Number(branch_id) : (req.branchId ?? null);

    const duplicate = await pool.query(
      `SELECT id FROM itinerary_templates
       WHERE branch_id IS NOT DISTINCT FROM $1
       AND LOWER(COALESCE(state_name, '')) = LOWER($2)
       AND is_active = TRUE
       AND id IN (
         SELECT itinerary_id
         FROM itinerary_template_days
         GROUP BY itinerary_id
         HAVING STRING_AGG((night_count::text || 'N ' || city_name), ' / ' ORDER BY day_number) = $3
       )
       LIMIT 1`,
      [effectiveBranchId, stateName, plan.replace(/\s\(\d+\sNights\)$/, '')]
    );
    if (duplicate.rowCount > 0) return res.status(409).json({ message: 'A similar itinerary plan already exists.' });

    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO itinerary_templates (title, state_name, branch_id, total_nights, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [String(title).trim(), stateName, effectiveBranchId, totalNights, Boolean(is_active)]
    );
    const itinerary = inserted.rows[0];

    for (const d of normalizedDays) {
      await client.query(
        `INSERT INTO itinerary_template_days (itinerary_id, day_number, city_id, city_name, night_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [itinerary.id, d.day_number, d.city_id, d.city_name, d.night_count]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ...itinerary, days: normalizedDays, plan });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('itineraryTemplate.create:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    client.release();
  }
};

export const update = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, branch_id, is_active, days = [] } = req.body || {};
    const stateName = await resolveStateName(req.body || {});
    if (!title || !stateName) return res.status(400).json({ message: 'Title and state are required.' });
    if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ message: 'At least one city row is required.' });

    const normalizedDays = days.map((d, i) => ({
      day_number: i + 1,
      city_id: d.city_id ? Number(d.city_id) : null,
      city_name: String(d.city_name || '').trim(),
      night_count: Number(d.night_count || 0),
    }));
    if (normalizedDays.some((d) => !d.city_name || !Number.isFinite(d.night_count) || d.night_count <= 0)) {
      return res.status(400).json({ message: 'Each row must have city and nights > 0.' });
    }
    const { totalNights, plan } = buildPlan(normalizedDays);
    const effectiveBranchId = branch_id ? Number(branch_id) : (req.branchId ?? null);

    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE itinerary_templates
       SET title = $1, state_name = $2, branch_id = $3, total_nights = $4,
           is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [String(title).trim(), stateName, effectiveBranchId, totalNights, is_active, Number(id)]
    );
    if (updated.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Itinerary template not found.' });
    }
    await client.query('DELETE FROM itinerary_template_days WHERE itinerary_id = $1', [Number(id)]);
    for (const d of normalizedDays) {
      await client.query(
        `INSERT INTO itinerary_template_days (itinerary_id, day_number, city_id, city_name, night_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [Number(id), d.day_number, d.city_id, d.city_name, d.night_count]
      );
    }
    await client.query('COMMIT');
    res.json({ ...updated.rows[0], days: normalizedDays, plan });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('itineraryTemplate.update:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    client.release();
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE itinerary_templates
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [Number(id)]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Itinerary template not found.' });
    res.json({ message: 'Template disabled.' });
  } catch (err) {
    console.error('itineraryTemplate.remove:', err.message || err);
    res.status(500).json({ message: 'Server error.' });
  }
};
