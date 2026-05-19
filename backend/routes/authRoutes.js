import express from 'express';
import {register,login,logout,googleAuth} from '../controllers/authController.js';

const router = express.Router();

//route to register a new user
router.post('/register', register);

//route to login a user
router.post('/login', login);

//route to logout a user
router.post('/logout', logout);

// //route to authenticate with Google
// router.post('/google', googleAuth);
export default router;