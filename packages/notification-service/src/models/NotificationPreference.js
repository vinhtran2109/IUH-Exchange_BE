import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: {
      ORDER: { type: Boolean, default: true },
      CHAT: { type: Boolean, default: false },
      SYSTEM: { type: Boolean, default: true },
      KARMA: { type: Boolean, default: true },
      REPORT: { type: Boolean, default: true },
      PRODUCT: { type: Boolean, default: true },
    },
    push: {
      ORDER: { type: Boolean, default: true },
      CHAT: { type: Boolean, default: true },
      SYSTEM: { type: Boolean, default: true },
      KARMA: { type: Boolean, default: true },
      REPORT: { type: Boolean, default: true },
      PRODUCT: { type: Boolean, default: true },
    },
    inApp: {
      ORDER: { type: Boolean, default: true },
      CHAT: { type: Boolean, default: true },
      SYSTEM: { type: Boolean, default: true },
      KARMA: { type: Boolean, default: true },
      REPORT: { type: Boolean, default: true },
      PRODUCT: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
