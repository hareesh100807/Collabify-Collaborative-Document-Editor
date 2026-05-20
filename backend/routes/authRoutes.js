import express from 'express';
import {register,login,logout,googleAuth,getMe} from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
const router = express.Router();

//route to register a new user
router.post('/register', register);

//route to login a user
router.post('/login', login);

//route to logout a user
router.post('/logout', logout);

//route to get current user data
router.get('/me', authMiddleware, getMe);

// //route to authenticate with Google
// router.post('/google', googleAuth);
export default router;