import express from 'express';
import * as m from '../controllers/mastersController.js';
import { verifyToken, adminOrManager, anyAuth, branchScope } from '../middleware/auth.js';
import { uploadImages } from '../middleware/upload.js';

const router = express.Router();
router.use(verifyToken);
router.use(branchScope);
router.get('/cities', anyAuth, m.listCities);
router.get('/hotels', anyAuth, m.listHotels);
router.get('/vehicles', anyAuth, m.listVehicles);
router.get('/activities', anyAuth, m.listActivities);

router.use(adminOrManager);
router.post('/upload', (req, res, next) => {
  req.query.folder = req.query.folder || 'activities';
  next();
}, (req, res, next) => {
  uploadImages.single('file')(req, res, (err) => {
    if (err) {
      console.error('Masters upload:', err.message || err);
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    next();
  });
}, m.uploadFile);

router.post('/cities', m.createCity);
router.put('/cities/:id', m.updateCity);
router.delete('/cities/:id', m.removeCity);

router.post('/hotels', m.createHotel);
router.put('/hotels/:id', m.updateHotel);
router.delete('/hotels/:id', m.removeHotel);

router.post('/vehicles', m.createVehicle);
router.put('/vehicles/:id', m.updateVehicle);
router.delete('/vehicles/:id', m.removeVehicle);

router.post('/activities', m.createActivity);
router.put('/activities/:id', m.updateActivity);
router.delete('/activities/:id', m.removeActivity);

export default router;
