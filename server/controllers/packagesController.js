import pool from '../config/db.js';

/**
 * GET /api/packages - List all packages (public for listing, used by both admin and user)
 */
export const getPackages = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, price, location, days, image_url, created_at FROM packages ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get packages error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * POST /api/packages - Create package (admin only)
 */
export const createPackage = async (req, res) => {
  try {
    const { title, description, price, location, days, image_url } = req.body;

    if (!title || !description || price == null) {
      return res.status(400).json({ message: 'Title, description and price are required.' });
    }

    const result = await pool.query(
      'INSERT INTO packages (title, description, price, location, days, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        title,
        description,
        Number(price),
        location || null,
        days ? Number(days) : null,
        image_url || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create package error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * PUT /api/packages/:id - Update package (admin only)
 */
export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, location, days, image_url } = req.body;

    const result = await pool.query(
      `UPDATE packages SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        location = COALESCE($4, location),
        days = COALESCE($5, days),
        image_url = COALESCE($6, image_url)
      WHERE id = $7 RETURNING *`,
      [
        title,
        description,
        price != null ? Number(price) : null,
        location,
        days != null ? Number(days) : null,
        image_url,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Package not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update package error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * DELETE /api/packages/:id - Delete package (admin only)
 */
export const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM packages WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Package not found.' });
    }

    res.json({ message: 'Package deleted successfully.' });
  } catch (err) {
    console.error('Delete package error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
