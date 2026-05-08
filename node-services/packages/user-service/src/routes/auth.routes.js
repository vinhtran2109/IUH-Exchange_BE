import { Router } from 'express';
import { validate, authenticate } from '@iuh-exchange/common';
import { registerSchema, loginSchema, verifyOtpSchema } from './auth.schema.js';
import * as authCtrl from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), authCtrl.register);
router.post('/verify-otp', validate(verifyOtpSchema), authCtrl.verifyOtp);
router.post('/login', validate(loginSchema), authCtrl.login);
router.post('/refresh-token', authCtrl.refreshToken);
router.post('/logout', authenticate, authCtrl.logout);
router.get('/me', authenticate, authCtrl.getProfile);

export default router;
