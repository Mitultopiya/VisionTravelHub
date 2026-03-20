import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from './config/db.js';

import { initDb } from './config/initDb.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import customersRoutes from './routes/customersRoutes.js';
import mastersRoutes from './routes/mastersRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import branchesRoutes from './routes/branchesRoutes.js';
import itineraryTemplateRoutes from './routes/itineraryTemplateRoutes.js';
import { verifyToken, adminOrManager } from './middleware/auth.js';
import { uploadImages } from './middleware/upload.js';
import * as packagesController from './controllers/packagesController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
const packagesUploadDir = path.join(uploadsDir, 'packages');
const paymentUploadDir = path.join(uploadsDir, 'payment');
if (!fs.existsSync(packagesUploadDir)) {
  fs.mkdirSync(packagesUploadDir, { recursive: true });
}
if (!fs.existsSync(paymentUploadDir)) {
  fs.mkdirSync(paymentUploadDir, { recursive: true });
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve package images explicitly (same path multer uses: uploads/packages/)
app.get('/uploads/packages/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!filename) return res.status(404).send('Not found');
  const filepath = path.join(uploadsDir, 'packages', filename);
  res.sendFile(filepath, (err) => {
    if (err && !res.headersSent) res.status(404).send('Not found');
  });
});

app.use('/uploads', express.static(uploadsDir));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/masters', mastersRoutes);

// Package image upload (must be before /api/packages so /upload is not matched as :id)
app.post('/api/packages/upload', verifyToken, adminOrManager, (req, res, next) => {
  req.query.folder = 'packages';
  next();
}, (req, res, next) => {
  uploadImages.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload middleware:', err.message || err);
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    next();
  });
}, packagesController.uploadFile);

app.use('/api/packages', packageRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/admin/itinerary-template', itineraryTemplateRoutes);

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
