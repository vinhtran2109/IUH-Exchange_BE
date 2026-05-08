import { Router } from 'express';
import { authenticate } from '@iuh-exchange/common';
import { generatePresignedUploadUrl } from '../services/s3.service.js';
import { ApiResponse } from '@iuh-exchange/common';

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/chat/upload-url
 * Get a presigned S3 URL for chat image upload.
 */
router.post('/upload-url', async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) {
    return res.status(400).json({ success: false, message: 'filename and contentType required' });
  }
  const { presignedUrl, publicUrl } = await generatePresignedUploadUrl(filename, contentType);
  res.json(ApiResponse.ok({ presignedUrl, publicUrl }));
});

export default router;
