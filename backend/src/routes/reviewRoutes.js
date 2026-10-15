import express from 'express';
import { 
  createReview, 
  getAllReviews, 
  updateReview, 
  deleteReview,
  publishReview,
  getAssignedReviews,
  submitReviewMarks,
  getReviewMarksById,
  getAllReviewMarks,
  getStudentMarks,
  getReviewDetailsForStudent
} from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// ================= COORDINATOR ROUTES =================
router.post('/', authorize('COORDINATOR', 'ADMIN'), createReview);
router.get('/', authorize('COORDINATOR', 'ADMIN'), getAllReviews);
router.post('/:id/publish', authorize('COORDINATOR', 'ADMIN'), publishReview);
router.put('/:id', authorize('COORDINATOR', 'ADMIN'), updateReview);
router.delete('/:id', authorize('COORDINATOR', 'ADMIN'), deleteReview);

// ================= STUDENT ROUTES =================
router.get('/student/marks', authorize('STUDENT'), getStudentMarks);
router.get('/student/schedules', authorize('STUDENT'), getReviewDetailsForStudent);

// ================= MARKS & EVALUATION ROUTES =================
router.get('/marks', authorize('FACULTY', 'COORDINATOR', 'ADMIN'), getAllReviewMarks);
router.get('/faculty/assigned', authorize('FACULTY', 'ADMIN'), getAssignedReviews);
router.get('/:id/marks', authorize('FACULTY', 'COORDINATOR', 'ADMIN'), getReviewMarksById);
router.post('/:id/marks', authorize('FACULTY', 'ADMIN'), submitReviewMarks);

export default router;
