/**
 * Consent Log Model
 *
 * Tracks user consent for AI image analysis and MSSV extraction.
 * Required for privacy compliance — users must opt-in before their
 * images are processed by AI/OCR.
 */

import mongoose from 'mongoose';

const consentLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    consentType: {
      type: String,
      enum: ['IMAGE_ANALYSIS', 'MSSV_EXTRACTION', 'AUTO_NOTIFICATION'],
      required: true,
    },
    granted: {
      type: Boolean,
      required: true,
    },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);

consentLogSchema.index({ userId: 1, itemId: 1, consentType: 1 });

export const ConsentLog = mongoose.model('ConsentLog', consentLogSchema);
