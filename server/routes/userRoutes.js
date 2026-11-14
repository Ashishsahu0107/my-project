import express from 'express';
import { getAllUsers, getUserById } from '../controllers/userController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllUsers);
router.get('/:id', getUserById);

export default router;
