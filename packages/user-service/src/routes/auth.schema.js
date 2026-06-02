import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .regex(/@student\.iuh\.edu\.vn$/, 'Email phải có đuôi @student.iuh.edu.vn'),
  password: z.string().min(6, 'Mật khẩu phải ít nhất 6 ký tự'),
  name: z.string().min(1).max(100),
  studentId: z.string().max(20).optional(),
});

export const checkEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .regex(/^\d{6,12}\.[^@]+@student\.iuh\.edu\.vn$/, 'Email sinh vien phai co dang MSSV.ten@student.iuh.edu.vn'),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().length(6),
});

export const resendOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Mật khẩu cũ không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải ít nhất 6 ký tự'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(6, 'Mật khẩu mới phải ít nhất 6 ký tự'),
});
