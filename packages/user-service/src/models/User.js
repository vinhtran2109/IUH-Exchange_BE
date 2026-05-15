import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /(@student\.iuh\.edu\.vn$)|(@deleted\.iuh\.edu\.vn$)/,
  },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  studentId: { type: String, default: '' },
  studentVerification: {
    status: {
      type: String,
      enum: ['UNSUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'],
      default: 'UNSUBMITTED',
      index: true,
    },
    submittedStudentId: { type: String, default: '' },
    evidenceUrl: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null },
  },
  avatarUrl: { type: String, default: '' },
  bankInfo: {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountHolder: { type: String, default: '' },
    qrCodeUrl: { type: String, default: '' },
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  karmaPoint: { type: Number, default: 100 },
  role: {
    type: String,
    enum: ['STUDENT', 'MODERATOR', 'ADMIN'],
    default: 'STUDENT',
  },
  permissions: {
    type: [String],
    default: ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
  },
  otp: { type: String },
  otpExpiry: { type: Date },
  otpAttemptCount: { type: Number, default: 0 },
  refreshToken: { type: String },
  passwordResetOtp: { type: String },
  passwordResetOtpExpiry: { type: Date },
  adminTwoFactorEnabled: { type: Boolean, default: true },
  adminLoginOtp: { type: String },
  adminLoginOtpExpiry: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

userSchema.index({ email: 1 });
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string', $gt: '' } } }
);

export const User = mongoose.model('User', userSchema);
