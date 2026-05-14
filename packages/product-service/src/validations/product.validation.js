import { z } from 'zod';

const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'];

export const createProductSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(5, 'Description must be at least 5 characters')
    .max(2000, 'Description must be at most 2000 characters'),
  price: z
    .number({ required_error: 'Price is required' })
    .min(0, 'Price cannot be negative'),
  category: z
    .string({ required_error: 'Category is required' })
    .min(1, 'Category is required'),
  location: z.string().max(160, 'Location must be at most 160 characters').optional().default(''),
  condition: z.enum(CONDITIONS, {
    errorMap: () => ({ message: `Condition must be one of: ${CONDITIONS.join(', ')}` }),
  }),
  imageUrls: z
    .array(z.string().url('Each image URL must be valid'))
    .max(5, 'Maximum 5 images allowed')
    .optional()
    .default([]),
});

export const uploadUrlSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
});

export const paginationSchema = z.object({
  // Cho phép 0 để tránh lỗi đồng bộ Frontend/Backend, 
  // nhưng controller sẽ luôn dùng Math.max(1, page)
  page: z.coerce.number().int().min(0).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
});

export const adminProductListSchema = paginationSchema.extend({
  status: z.string().optional(),
});

export const searchSchema = z.object({
  keyword: z.string().min(1, 'Search keyword is required'),
  page: z.coerce.number().int().min(0).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  category: z.string().optional(),
  condition: z.enum(CONDITIONS).optional(),
  location: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'date_asc', 'date_desc']).optional(),
});

export const resolveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT'], {
    errorMap: () => ({ message: 'Action must be APPROVE or REJECT' }),
  }),
});
