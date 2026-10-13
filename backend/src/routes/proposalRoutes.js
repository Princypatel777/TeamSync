import express from 'express';
import {
  getMyProposal,
  saveProposalDraft,
  getAiRecommendations,
  runSimilarityCheck,
  submitProposal,
  reviewProposal,
  getAssignedProposals,
  assignFacultyGuide,
  requestEdit,
  createNewProposal,
  withdrawProposal,
  deleteProposal,
} from '../controllers/proposalController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Student endpoints
router.get('/my-proposal', authorize('STUDENT', 'ADMIN'), getMyProposal);
router.put('/draft', authorize('STUDENT', 'ADMIN'), saveProposalDraft);
router.post('/ai-recommendations', authorize('STUDENT', 'ADMIN'), getAiRecommendations);
router.post('/similarity-check', authorize('STUDENT', 'ADMIN'), runSimilarityCheck);
router.post('/create', authorize('STUDENT', 'ADMIN'), createNewProposal);
router.post('/submit', authorize('STUDENT', 'ADMIN'), submitProposal);
router.post('/withdraw', authorize('STUDENT', 'ADMIN'), withdrawProposal);

// Faculty & Admin endpoints
router.get('/assigned', authorize('FACULTY', 'COORDINATOR', 'ADMIN'), getAssignedProposals);
router.post('/:id/review', authorize('FACULTY', 'COORDINATOR', 'ADMIN'), reviewProposal);
router.post('/:id/assign-guide', authorize('COORDINATOR', 'ADMIN'), assignFacultyGuide);
router.post('/request-edit', authorize('STUDENT', 'ADMIN'), requestEdit);
router.delete('/:id', authorize('STUDENT', 'ADMIN', 'COORDINATOR'), deleteProposal);

export default router;
