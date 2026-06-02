import { Router } from 'express';
import { validate, authenticate } from '@iuh-exchange/common';
import {
  registerSchema,
  checkEmailSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import * as authCtrl from '../controllers/auth.controller.js';

const router = Router();

// Express 4 does NOT catch async errors — they become unhandled rejections
// and crash the process. This wrapper catches them and forwards to the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/register', validate(registerSchema), asyncHandler(authCtrl.register));
router.post('/check-email', validate(checkEmailSchema), asyncHandler(authCtrl.checkEmail));
router.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(authCtrl.verifyOtp));
router.post('/resend-otp', validate(resendOtpSchema), asyncHandler(authCtrl.resendOtp));
router.post('/login', validate(loginSchema), asyncHandler(authCtrl.login));
router.post('/refresh-token', asyncHandler(authCtrl.refreshToken));
router.post('/logout', authenticate, asyncHandler(authCtrl.logout));

router.put('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(authCtrl.changePassword));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(authCtrl.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(authCtrl.resetPassword));

export default router;
