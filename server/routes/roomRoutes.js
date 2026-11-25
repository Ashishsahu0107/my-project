import express from 'express';
import {
  getRooms,
  getRoomById,
  createRoom,
  joinRoom,
  toggleFavoriteRoom,
  togglePinRoom,
  toggleArchiveRoom,
  createGroup,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  setGroupAdmin,
  leaveGroup,
  deleteGroup
} from '../controllers/roomController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validateRoom } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getRooms);
router.get('/:id', getRoomById);
router.post('/', validateRoom, createRoom);
router.post('/:id/join', joinRoom);
router.post('/:id/favorite', toggleFavoriteRoom);
router.post('/:id/pin', togglePinRoom);
router.post('/:id/archive', toggleArchiveRoom);
router.post('/group', createGroup);
router.put('/group/:id', updateGroup);
router.post('/group/:id/members', addGroupMembers);
router.delete('/group/:id/members/:memberId', removeGroupMember);
router.post('/group/:id/admin', setGroupAdmin);
router.post('/group/:id/leave', leaveGroup);
router.delete('/group/:id', deleteGroup);

export default router;
