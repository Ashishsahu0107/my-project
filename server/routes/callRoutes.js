import express from 'express';
import { getCallHistory, getCallStats } from '../controllers/callController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/history', getCallHistory);
router.get('/stats', getCallStats);

export default router;
