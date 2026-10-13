import express from 'express';
import {
  createGroup,
  joinGroupByCode,
  getMyGroup,
  inviteMember,
  respondInvite,
  leaveGroup,
  getAllGroups,
  markGroupReady,
  deleteGroup,
  cancelInvite,
  removeMember,
} from '../controllers/groupController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('STUDENT', 'ADMIN'), createGroup);
router.post('/join-by-code', authorize('STUDENT', 'ADMIN'), joinGroupByCode);
router.get('/my-group', getMyGroup);
router.post('/:id/invite', authorize('STUDENT', 'ADMIN'), inviteMember);
router.delete('/invites/:inviteId', authorize('STUDENT', 'ADMIN'), cancelInvite);
router.post('/invites/:inviteId/respond', respondInvite);
router.post('/:id/leave', leaveGroup);
router.delete('/:id/members/:memberId', authorize('STUDENT', 'ADMIN'), removeMember);
router.put('/:id/ready', authorize('STUDENT', 'ADMIN'), markGroupReady);
router.get('/', authorize('ADMIN', 'COORDINATOR', 'FACULTY'), getAllGroups);
router.delete('/:id', authorize('ADMIN', 'COORDINATOR'), deleteGroup);

export default router;
