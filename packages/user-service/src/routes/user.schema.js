import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
}).refine((data) => data.name !== undefined || data.avatarUrl !== undefined, {
  message: 'Phải cung cấp ít nhất name hoặc avatarUrl',
});

export const avatarPresignSchema = z.object({
  contentType: z.string().regex(/^image\//, 'contentType phải là image/*'),
});
