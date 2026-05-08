import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { config, logger } from '@iuh-exchange/common';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const BUCKET = config.aws.s3Bucket;
const PRESIGNED_EXPIRY = parseInt(process.env.S3_PRESIGNED_URL_EXPIRY || '3600', 10);

/**
 * Generate a presigned PUT URL for direct client upload to S3.
 * @param {string} originalFilename
 * @param {string} contentType
 * @returns {Promise<{ presignedUrl: string, publicUrl: string, objectKey: string }>}
 */
export async function generatePresignedUploadUrl(originalFilename, contentType) {
  const ext = originalFilename?.includes('.')
    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
    : '';
  const objectKey = `products/${crypto.randomUUID()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_EXPIRY,
  });

  const publicUrl = `https://${BUCKET}.s3.${config.aws.region}.amazonaws.com/${objectKey}`;

  return { presignedUrl, publicUrl, objectKey };
}

/**
 * Delete a file from S3 by its public URL.
 * Silently logs errors so it doesn't break the parent flow.
 * @param {string} publicUrl
 */
export async function deleteFileByUrl(publicUrl) {
  try {
    const idx = publicUrl.indexOf('products/');
    if (idx === -1) return;
    const objectKey = publicUrl.substring(idx);

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey })
    );
    logger.info(`S3 deleted: ${objectKey}`);
  } catch (err) {
    logger.warn(`S3 delete failed for ${publicUrl}: ${err.message}`);
  }
}
