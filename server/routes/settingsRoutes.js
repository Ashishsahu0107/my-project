import express from 'express';
import { getAppSettings, updateAppSettings } from '../controllers/settingsController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAppSettings);
router.put('/', updateAppSettings);

export default router;
