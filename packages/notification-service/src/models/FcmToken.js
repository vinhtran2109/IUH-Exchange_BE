import mongoose from 'mongoose';

/**
 * Stores FCM device tokens for push notifications.
 * A user can have multiple tokens (multiple devices).
 */
const fcmTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'web',
    },
    deviceName: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

fcmTokenSchema.index({ userId: 1, isActive: 1 });

export const FcmToken = mongoose.model('FcmToken', fcmTokenSchema);
