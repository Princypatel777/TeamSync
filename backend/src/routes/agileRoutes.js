import express from 'express';
import {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  getSprints,
  createSprint,
  updateSprint,
  updateSprintStatus,
  deleteSprint,
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getBugs,
  createBug,
  updateBug,
  updateBugStatus,
  deleteBug,
  getTraceabilityChain,
} from '../controllers/agileController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Requirements
router.get('/requirements', getRequirements);
router.post('/requirements', authorize('STUDENT', 'ADMIN'), createRequirement);
router.put('/requirements/:id', authorize('STUDENT', 'ADMIN'), updateRequirement);
router.delete('/requirements/:id', authorize('STUDENT', 'ADMIN'), deleteRequirement);

// Features
router.get('/features', getFeatures);
router.post('/features', authorize('STUDENT', 'ADMIN'), createFeature);
router.put('/features/:id', authorize('STUDENT', 'ADMIN'), updateFeature);
router.delete('/features/:id', authorize('STUDENT', 'ADMIN'), deleteFeature);

// Sprints
router.get('/sprints', getSprints);
router.post('/sprints', authorize('STUDENT', 'ADMIN'), createSprint);
router.put('/sprints/:id', authorize('STUDENT', 'ADMIN'), updateSprint);
router.put('/sprints/:id/status', authorize('STUDENT', 'ADMIN'), updateSprintStatus);
router.delete('/sprints/:id', authorize('STUDENT', 'ADMIN'), deleteSprint);

// Tasks & Kanban
router.get('/tasks', getTasks);
router.post('/tasks', authorize('STUDENT', 'ADMIN'), createTask);
router.put('/tasks/:id', authorize('STUDENT', 'ADMIN', 'FACULTY', 'COORDINATOR'), updateTask);
router.put('/tasks/:id/status', authorize('STUDENT', 'ADMIN', 'FACULTY', 'COORDINATOR'), updateTaskStatus);
router.delete('/tasks/:id', authorize('STUDENT', 'ADMIN'), deleteTask);

// Bugs
router.get('/bugs', getBugs);
router.post('/bugs', authorize('STUDENT', 'ADMIN'), createBug);
router.put('/bugs/:id', authorize('STUDENT', 'ADMIN', 'FACULTY'), updateBug);
router.put('/bugs/:id/status', authorize('STUDENT', 'ADMIN', 'FACULTY'), updateBugStatus);
router.delete('/bugs/:id', authorize('STUDENT', 'ADMIN'), deleteBug);

// Traceability Matrix
router.get('/traceability', getTraceabilityChain);

export default router;
