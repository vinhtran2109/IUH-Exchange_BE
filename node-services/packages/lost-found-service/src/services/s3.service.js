import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, logger } from '@iuh-exchange/common';
import crypto from 'node:crypto';

const EXPIRY_SECONDS = parseInt(process.env.AWS_S3_PRESIGNED_EXPIRY || '3600', 10);
const BUCKET = process.env.S3_BUCKET_NAME || config.aws.s3Bucket;

const s3Client = new S3Client({
  region: process.env.AWS_REGION || config.aws.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || config.aws.accessKeyId,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || config.aws.secretAccessKey,
  },
});

/**
 * Generate a presigned PUT URL for client-side S3 uploads.
 * Returns { presignedUrl, publicUrl }.
 */
export async function generatePresignedUploadUrl(filename, contentType) {
  const extension = filename?.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
  const objectKey = `lostfound/${crypto.randomUUID()}${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: EXPIRY_SECONDS });
  const publicUrl = presignedUrl.split('?')[0];

  return { presignedUrl, publicUrl };
}

/**
 * Delete an S3 object by its public URL.
 * Silently ignores failures (best-effort cleanup).
 */
export async function deleteFileByUrl(publicUrl) {
  try {
    if (!publicUrl || !publicUrl.includes('lostfound/')) return;
    const objectKey = publicUrl.substring(publicUrl.indexOf('lostfound/'));

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
      }),
    );
    logger.info(`S3 deleted: ${objectKey}`);
  } catch (err) {
    logger.warn(`S3 delete failed for ${publicUrl}: ${err.message}`);
  }
}
