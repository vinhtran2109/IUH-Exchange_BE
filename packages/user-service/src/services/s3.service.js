import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@iuh-exchange/common';

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || '';
const S3_REGION = process.env.AWS_S3_REGION || 'ap-southeast-1';

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Tạo presigned URL để client upload avatar trực tiếp lên S3
 */
export async function getAvatarUploadUrl(userId, contentType) {
  const ext = contentType.split('/')[1] || 'png';
  const key = `avatars/${userId}/${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const publicUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

  logger.info(`[S3] Generated presigned upload URL for user ${userId}`);

  return { uploadUrl, publicUrl, key };
}

/**
 * Upload avatar từ buffer (server-side upload)
 */
export async function uploadAvatarBuffer(userId, buffer, contentType) {
  const ext = contentType.split('/')[1] || 'png';
  const key = `avatars/${userId}/${uuidv4()}.${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  const publicUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  logger.info(`[S3] Uploaded avatar for user ${userId}: ${publicUrl}`);

  return publicUrl;
}
