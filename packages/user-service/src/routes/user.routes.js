import { Router } from 'express';
import { validate, authenticate } from '@iuh-exchange/common';
import { updateProfileSchema, avatarPresignSchema } from './user.schema.js';
import { changePasswordSchema } from './auth.schema.js';
import { changePassword } from '../controllers/auth.controller.js';
import { getMyKarmaHistory } from '../controllers/karma.controller.js';
import * as userCtrl from '../controllers/user.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/me', authenticate, asyncHandler(userCtrl.getMyProfile));
router.get('/:id', asyncHandler(userCtrl.getUserProfile));
router.put('/profile', authenticate, validate(updateProfileSchema), asyncHandler(userCtrl.updateProfile));
router.patch('/me', authenticate, validate(updateProfileSchema), asyncHandler(userCtrl.updateProfile));
router.post('/password', authenticate, validate(changePasswordSchema), asyncHandler(changePassword));
router.get('/me/karma-history', authenticate, asyncHandler(getMyKarmaHistory));
router.post('/avatar/presign', authenticate, validate(avatarPresignSchema), asyncHandler(userCtrl.getAvatarPresign));
router.delete('/me', authenticate, asyncHandler(userCtrl.deleteAccount));

export default router;
