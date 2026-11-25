import express from 'express';
import {
  getSecurityOverview,
  enableTwoStepPin,
  disableTwoStepPin,
  verifyTwoStepPin,
  updatePrivacySettings,
  blockUser,
  unblockUser,
  getActiveSessions,
  revokeSession,
  logoutAllDevices
} from '../controllers/securityController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/overview', getSecurityOverview);
router.post('/two-step/enable', enableTwoStepPin);
router.post('/two-step/disable', disableTwoStepPin);
router.post('/two-step/verify', verifyTwoStepPin);
router.put('/privacy', updatePrivacySettings);
router.post('/block/:userId', blockUser);
router.delete('/block/:userId', unblockUser);
router.get('/sessions', getActiveSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.post('/logout-all', logoutAllDevices);

export default router;
