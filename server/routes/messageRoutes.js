import express from 'express';
import {
  getMessagesByRoom,
  sendMessage,
  markRoomMessagesRead,
  reactToMessage
} from '../controllers/messageController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validateMessage } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/room/:roomId', getMessagesByRoom);
router.post('/room/:roomId/read', markRoomMessagesRead);
router.post('/', validateMessage, sendMessage);
router.post('/:id/react', reactToMessage);

export default router;
