import express from 'express';
import { 
  login, 
  register, 
  googleAuth, 
  getPublicDepartments, 
  getMe, 
  logout 
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/google', googleAuth);
router.get('/departments', getPublicDepartments);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;

