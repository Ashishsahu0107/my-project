import express from 'express';
import {
  getBackupStatus,
  updateBackupSettings,
  createBackup,
  restoreBackup,
  syncData
} from '../controllers/backupController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/status', getBackupStatus);
router.put('/settings', updateBackupSettings);
router.post('/create', createBackup);
router.post('/restore', restoreBackup);
router.get('/sync', syncData);

export default router;
