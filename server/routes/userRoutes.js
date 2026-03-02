import express from 'express';
import { getUsers, createUser, deleteUser } from '../controllers/usersController.js';
import { verifyToken, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.use(adminOnly);

router.get('/', getUsers);
router.post('/', createUser);
router.delete('/:id', deleteUser);

export default router;
