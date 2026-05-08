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
  avatar: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  karmaPoint: { type: Number, default: 0 },
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
  refreshToken: { type: String },
}, {
  timestamps: true,
});

// Index
userSchema.index({ email: 1 });

export const User = mongoose.model('User', userSchema);
