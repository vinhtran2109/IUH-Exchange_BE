import { Router } from 'express';
import { validate, authenticate } from '@iuh-exchange/common';
import { updateProfileSchema, avatarPresignSchema } from './user.schema.js';
import * as userCtrl from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticate, userCtrl.getMyProfile);
router.get('/:id', userCtrl.getUserProfile);
router.put('/profile', authenticate, validate(updateProfileSchema), userCtrl.updateProfile);
router.post('/avatar/presign', authenticate, validate(avatarPresignSchema), userCtrl.getAvatarPresign);

export default router;
