import express from 'express';
import * as c from '../controllers/customersController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.post('/:id/family', c.addFamily);
router.delete('/:id/family/:fid', c.removeFamily);
router.put('/:id/family', c.setFamily);

export default router;
