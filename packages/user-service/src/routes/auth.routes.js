import { Router } from 'express';
import { validate, authenticate } from '@iuh-exchange/common';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import * as authCtrl from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), authCtrl.register);
router.post('/verify-otp', validate(verifyOtpSchema), authCtrl.verifyOtp);
router.post('/resend-otp', validate(resendOtpSchema), authCtrl.resendOtp);
router.post('/login', validate(loginSchema), authCtrl.login);
router.post('/refresh-token', authCtrl.refreshToken);
router.post('/logout', authenticate, authCtrl.logout);

router.put('/change-password', authenticate, validate(changePasswordSchema), authCtrl.changePassword);
router.post('/forgot-password', validate(forgotPasswordSchema), authCtrl.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authCtrl.resetPassword);

export default router;
