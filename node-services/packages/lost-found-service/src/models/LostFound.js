import mongoose from 'mongoose';

const lostFoundItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: {
    type: String,
    enum: ['LOST', 'FOUND'],
    required: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  images: [{ type: String }],
  location: { type: String },
  status: {
    type: String,
    enum: ['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
    index: true,
  },
}, { timestamps: true });

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['USER', 'PRODUCT', 'LOST_FOUND'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'],
    default: 'PENDING',
    index: true,
  },
}, { timestamps: true });

export const LostFoundItem = mongoose.model('LostFoundItem', lostFoundItemSchema);
export const Report = mongoose.model('Report', reportSchema);
