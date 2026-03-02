import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from './config/db.js';

import { initDb } from './config/initDb.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/bookings', bookingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Ensure default admin exists on startup
 */
async function ensureDefaultAdmin() {
  try {
    const adminEmail = 'admin@travel.com';
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

    if (result.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Admin', adminEmail, hashedPassword, 'admin']
      );
      console.log('Default admin created: admin@travel.com / admin123');
    }
  } catch (err) {
    console.error('Error ensuring default admin:', err.message);
  }
}

// Start server after ensuring DB is ready and default admin exists
app.listen(PORT, async () => {
  try {
    await initDb();
    await ensureDefaultAdmin();
    console.log(`Server running on http://localhost:${PORT}`);
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
});
