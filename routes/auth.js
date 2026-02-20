// src/routes/auth.js
import express from 'express';
import { 
  register, 
  login, 
  requestOTP, 
  verifyOTP, 
  resetPassword,
  updatePassword 
} from '../controllers/authController.js'; // You'll need this middleware
import { resetPassprotect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Password reset routes
router.post('/forgot-password/request-otp', requestOTP);
router.post('/forgot-password/verify-otp', verifyOTP);
router.post('/forgot-password/reset', resetPassword);

// Protected route (requires authentication)
router.put('/update-password', resetPassprotect, updatePassword);

export default router;