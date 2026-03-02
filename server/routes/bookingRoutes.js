import express from 'express';
import {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus,
} from '../controllers/bookingsController.js';
import { verifyToken, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// User: create booking and get own bookings
router.post('/', verifyToken, createBooking);
router.get('/user', verifyToken, getMyBookings);

// Admin: get all bookings and update status
router.get('/', verifyToken, adminOnly, getAllBookings);
router.put('/:id/status', verifyToken, adminOnly, updateBookingStatus);

export default router;
