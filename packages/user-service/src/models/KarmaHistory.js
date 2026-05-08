import mongoose from 'mongoose';

const karmaHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  previousKarma: {
    type: Number,
    required: true,
  },
  newKarma: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    default: '',
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  source: {
    type: String,
    enum: ['ADMIN', 'ORDER', 'REPORT', 'SYSTEM'],
    default: 'ADMIN',
  },
}, {
  timestamps: true,
});

karmaHistorySchema.index({ userId: 1, createdAt: -1 });

export const KarmaHistory = mongoose.model('KarmaHistory', karmaHistorySchema);
