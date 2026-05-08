import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['ORDER', 'CHAT', 'SYSTEM', 'KARMA', 'REPORT', 'PRODUCT'],
      required: true,
      index: true,
    },
    targetId: { type: String, default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
