import express from 'express';
import {
  getMessagesByRoom,
  sendMessage,
  markRoomMessagesRead,
  reactToMessage,
  editMessage,
  deleteMessage,
  forwardMessage,
  searchMessages
} from '../controllers/messageController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { validateMessage } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/search', searchMessages);
router.get('/room/:roomId', getMessagesByRoom);
router.post('/room/:roomId/read', markRoomMessagesRead);
router.post('/', validateMessage, sendMessage);
router.post('/:id/react', reactToMessage);
router.post('/:id/forward', forwardMessage);
router.patch('/:id', editMessage);
router.delete('/:id', deleteMessage);

export default router;
