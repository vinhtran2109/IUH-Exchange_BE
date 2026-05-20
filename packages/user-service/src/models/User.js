import { SupabaseModel, baseRow, valueOrNull } from '@iuh-exchange/common';

function mapUserToRow(user) {
  return {
    ...baseRow(user),
    email: user.email,
    password_hash: user.passwordHash,
    name: user.name,
    student_id: valueOrNull(user.studentId),
    student_verification: user.studentVerification || {},
    avatar_url: user.avatarUrl || '',
    bank_info: user.bankInfo || {},
    is_verified: Boolean(user.isVerified),
    is_active: user.isActive !== false,
    karma_point: Number(user.karmaPoint ?? 100),
    role: user.role || 'STUDENT',
    permissions: Array.isArray(user.permissions) ? user.permissions : ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
    otp: valueOrNull(user.otp),
    otp_expiry: valueOrNull(user.otpExpiry),
    otp_attempt_count: Number(user.otpAttemptCount ?? 0),
    refresh_token: valueOrNull(user.refreshToken),
    password_reset_otp: valueOrNull(user.passwordResetOtp),
    password_reset_otp_expiry: valueOrNull(user.passwordResetOtpExpiry),
    admin_two_factor_enabled: user.adminTwoFactorEnabled !== false,
    admin_login_otp: valueOrNull(user.adminLoginOtp),
    admin_login_otp_expiry: valueOrNull(user.adminLoginOtpExpiry),
    failed_login_attempts: Number(user.failedLoginAttempts ?? 0),
    lock_until: valueOrNull(user.lockUntil),
    is_deleted: Boolean(user.isDeleted),
    deleted_at: valueOrNull(user.deletedAt),
  };
}

export const User = new SupabaseModel('users', mapUserToRow);
