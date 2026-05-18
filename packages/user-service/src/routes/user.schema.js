import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  bankInfo: z.object({
    bankName: z.string().max(120).optional().default(''),
    accountNumber: z.string().max(64).optional().default(''),
    accountHolder: z.string().max(120).optional().default(''),
    qrCodeUrl: z.string().url().or(z.literal('')).optional().default(''),
  }).optional(),
}).refine((data) => data.name !== undefined || data.avatarUrl !== undefined || data.bankInfo !== undefined, {
  message: 'Phai cung cap it nhat name, avatarUrl hoac bankInfo',
});

export const avatarPresignSchema = z.object({
  contentType: z.string().regex(/^image\//, 'contentType phai la image/*'),
});
