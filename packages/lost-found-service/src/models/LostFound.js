import mongoose from 'mongoose';

const lostFoundItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: ['LOST', 'FOUND'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    images: [{ type: String }],
    location: { type: String },
    contactInfo: { type: String },
    category: {
      type: String,
      enum: ['ELECTRONICS', 'ACCESSORIES', 'CLOTHING', 'DOCUMENTS', 'KEYS', 'BAGS', 'OTHER'],
      default: 'OTHER',
      index: true,
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    status: {
      type: String,
      enum: ['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    // ── AI Analysis Fields ──
    analysisStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'],
      default: 'SKIPPED',
      index: true,
    },
    detectedType: {
      type: String, // AI-detected object label (e.g., 'wallet', 'phone', 'keys')
      default: '',
    },
    analysisConfidence: {
      type: Number, // 0-1 confidence score from AI model
      min: 0,
      max: 1,
      default: 0,
    },
    extracted: {
      studentId: { type: String, default: '' }, // MSSV extracted via OCR
      text: { type: String, default: '' }, // Raw OCR text
    },
    analysisMetadata: {
      type: mongoose.Schema.Types.Mixed, // Store provider-specific metadata
      default: {},
    },
  },
  { timestamps: true },
);

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    targetType: {
      type: String,
      enum: ['USER', 'PRODUCT', 'LOST_FOUND'],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'],
      default: 'PENDING',
      index: true,
    },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
lostFoundItemSchema.index({ type: 1, status: 1, createdAt: -1 });
lostFoundItemSchema.index({ type: 1, category: 1, status: 1 });
lostFoundItemSchema.index({ tags: 1, type: 1, status: 1 });
lostFoundItemSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const LostFoundItem = mongoose.model('LostFoundItem', lostFoundItemSchema);
export const Report = mongoose.model('Report', reportSchema);
