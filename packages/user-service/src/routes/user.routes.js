import { Router } from 'express';
import { validate, authenticate } from '@iuh-exchange/common';
import { updateProfileSchema, avatarPresignSchema } from './user.schema.js';
import { changePasswordSchema } from './auth.schema.js';
import { changePassword } from '../controllers/auth.controller.js';
import { getMyKarmaHistory } from '../controllers/karma.controller.js';
import * as userCtrl from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticate, userCtrl.getMyProfile);
router.get('/:id', userCtrl.getUserProfile);
router.put('/profile', authenticate, validate(updateProfileSchema), userCtrl.updateProfile);
router.patch('/me', authenticate, validate(updateProfileSchema), userCtrl.updateProfile);
router.post('/password', authenticate, validate(changePasswordSchema), changePassword);
router.get('/me/karma-history', authenticate, getMyKarmaHistory);
router.post('/avatar/presign', authenticate, validate(avatarPresignSchema), userCtrl.getAvatarPresign);

export default router;
