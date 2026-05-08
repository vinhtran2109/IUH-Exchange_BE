import mongoose from 'mongoose';

const dlqEventSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    retryCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'RETRYING', 'DEAD'],
      default: 'PENDING',
      index: true,
    },
  },
  { timestamps: true }
);

dlqEventSchema.index({ status: 1, createdAt: -1 });

export const DlqEvent = mongoose.model('DlqEvent', dlqEventSchema);
