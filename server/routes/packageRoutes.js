import express from 'express';
import {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
} from '../controllers/packagesController.js';
import { verifyToken, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Public: list packages (no auth required for GET)
router.get('/', getPackages);

// Admin only for create/update/delete
router.post('/', verifyToken, adminOnly, createPackage);
router.put('/:id', verifyToken, adminOnly, updatePackage);
router.delete('/:id', verifyToken, adminOnly, deletePackage);

export default router;
