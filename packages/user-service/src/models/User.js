import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /@student\.iuh\.edu\.vn$/,
  },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  studentId: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
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
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
}, {
  timestamps: true,
});

userSchema.index({ email: 1 });

export const User = mongoose.model('User', userSchema);
