import express from 'express';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getWikiPages,
  saveWikiPage,
  deleteWikiPage,
  getChatMessages,
  getChatUnreadCounts,
  sendChatMessage,
  updateChatMessage,
  deleteChatMessage,
  getFiles,
  uploadFileRecord,
  downloadFile,
  deleteFile,
} from '../controllers/collaborationController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Milestones
router.get('/milestones', getMilestones);
router.post('/milestones', authorize('STUDENT', 'ADMIN'), createMilestone);
router.put('/milestones/:id', authorize('STUDENT', 'ADMIN', 'FACULTY', 'COORDINATOR'), updateMilestone);
router.delete('/milestones/:id', authorize('STUDENT', 'ADMIN'), deleteMilestone);

// Wiki
router.get('/wiki', getWikiPages);
router.post('/wiki', authorize('STUDENT', 'ADMIN'), saveWikiPage);
router.put('/wiki/:id', authorize('STUDENT', 'ADMIN'), saveWikiPage);
router.delete('/wiki/:id', authorize('STUDENT', 'ADMIN'), deleteWikiPage);

// Chat
router.get('/chat', getChatMessages);
router.get('/chat/unread', getChatUnreadCounts);
router.post('/chat', authorize('STUDENT', 'ADMIN', 'FACULTY', 'COORDINATOR'), sendChatMessage);
router.put('/chat/:id', authorize('STUDENT', 'ADMIN', 'FACULTY', 'COORDINATOR'), updateChatMessage);
router.delete('/chat/:id', authorize('STUDENT', 'ADMIN', 'FACULTY', 'COORDINATOR'), deleteChatMessage);

// Files & Docs
router.get('/files', getFiles);
router.post('/files', authorize('STUDENT', 'ADMIN'), uploadFileRecord);
router.get('/files/:id/download', downloadFile);
router.delete('/files/:id', authorize('STUDENT', 'ADMIN'), deleteFile);

export default router;
