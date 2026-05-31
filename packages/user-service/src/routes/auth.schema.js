import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .regex(/@student\.iuh\.edu\.vn$/, 'Email phải có đuôi @student.iuh.edu.vn'),
    password: z.string().min(6, 'Mật khẩu phải ít nhất 6 ký tự'),
    name: z.string().min(1).max(100),
    studentId: z
      .string()
      .length(8, 'Mã số sinh viên phải là 8 chữ số')
      .regex(/^[0-9]{8}$/, 'Mã số sinh viên phải là 8 chữ số'),
  })
  .superRefine((data, ctx) => {
    const prefix = data.email.trim().split('@')[0] || '';
    const first8Digits = prefix.match(/^[0-9]{8}/)?.[0] || '';
    if (first8Digits !== data.studentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentId'],
        message: 'Mã số sinh viên không khớp với email sinh viên',
      });
    }
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
