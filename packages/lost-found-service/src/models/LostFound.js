import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema(
  {
    claimantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    answer: { type: String, required: true, trim: true },
    evidenceUrls: [{ type: String }],
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
      default: 'PENDING',
      index: true,
    },
    ownerNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

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
    verificationQuestion: { type: String, default: '', maxlength: 300 },
    claims: { type: [claimSchema], default: [] },
    approvedClaimId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: {
      type: String,
      enum: ['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
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

export const LostFoundItem = mongoose.model('LostFoundItem', lostFoundItemSchema);
export const Report = mongoose.model('Report', reportSchema);
