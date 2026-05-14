import { z } from 'zod';

export const listUsersSchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  size: z.string().regex(/^\d+$/).optional(),
  search: z.string().max(100).optional(),
  role: z.enum(['STUDENT', 'MODERATOR', 'ADMIN']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['STUDENT', 'MODERATOR', 'ADMIN']),
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.enum([
    'CAN_POST',
    'CAN_CHAT',
    'CAN_REPORT',
    'CAN_BAN',
    'CAN_APPROVE_POST',
    'CAN_VIEW_AUDIT',
    'CAN_MANAGE_ORDERS',
    'CAN_RESOLVE_DISPUTES',
    'CAN_MANAGE_SYSTEM',
  ])).min(1),
});

export const adjustKarmaSchema = z.object({
  amount: z.number().int(),
  reason: z.string().max(500).optional(),
});

export const banUserSchema = z.object({
  reason: z.string().max(500).optional(),
});
