import express from 'express';
import * as c from '../controllers/itineraryTemplateController.js';
import { verifyToken, adminOrManager, anyAuth, branchScope } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.use(branchScope);

router.get('/cities', anyAuth, c.listCities);
router.get('/', anyAuth, c.list);

router.use(adminOrManager);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

export default router;
