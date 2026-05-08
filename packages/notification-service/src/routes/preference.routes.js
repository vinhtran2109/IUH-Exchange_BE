import { authenticate } from '@iuh-exchange/common';
import { Router } from 'express';
import { getPreferences, updatePreferences } from '../controllers/preference.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getPreferences);
router.put('/', updatePreferences);

export default router;
