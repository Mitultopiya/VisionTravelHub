import pool from '../config/db.js';

/**
 * POST /api/bookings - Create booking (user)
 */
export const createBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { package_id } = req.body;

    if (!package_id) {
      return res.status(400).json({ message: 'Package ID is required.' });
    }

    const pkgResult = await pool.query('SELECT id FROM packages WHERE id = $1', [package_id]);
    if (pkgResult.rowCount === 0) {
      return res.status(404).json({ message: 'Package not found.' });
    }

    const result = await pool.query(
      'INSERT INTO bookings (user_id, package_id, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, package_id, 'pending']
    );

    const booking = result.rows[0];
    const pkg = await pool.query('SELECT title, location, price, days FROM packages WHERE id = $1', [package_id]);
    res.status(201).json({
      ...booking,
      package: pkg.rows[0],
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * GET /api/bookings/user - Get current user's bookings
 */
export const getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT b.id, b.booking_date, b.status, b.created_at,
              p.id as package_id, p.title, p.location, p.price, p.days, p.image_url
       FROM bookings b
       JOIN packages p ON b.package_id = p.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get my bookings error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * GET /api/bookings - Get all bookings (admin only)
 */
export const getAllBookings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.booking_date, b.status, b.created_at,
              u.id as user_id, u.name as user_name, u.email as user_email,
              p.id as package_id, p.title as package_title, p.location, p.price, p.days
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN packages p ON b.package_id = p.id
       ORDER BY b.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get all bookings error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * PUT /api/bookings/:id/status - Update booking status (admin only)
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Status must be pending, confirmed or cancelled.' });
    }

    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update booking status error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
