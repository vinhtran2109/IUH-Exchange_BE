import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .email()
    .regex(/@student\.iuh\.edu\.vn$/, 'Email phải có đuôi @student.iuh.edu.vn'),
  password: z.string().min(6, 'Mật khẩu phải ít nhất 6 ký tự'),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
