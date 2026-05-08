import { S3Client } from '@aws-sdk/client-s3';
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
 * Generate a presigned PUT URL for chat image upload.
 */
export async function generatePresignedUploadUrl(originalFilename, contentType) {
  const ext = originalFilename?.includes('.')
    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
    : '';
  const objectKey = `chat/${crypto.randomUUID()}${ext}`;

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
