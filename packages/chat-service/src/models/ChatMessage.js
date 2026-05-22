import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    content: { type: String, default: '' },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE', 'PRODUCT_CONTEXT'],
      default: 'TEXT',
    },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    productContext: {
      id: { type: String, default: null },
      title: { type: String, default: '' },
      price: { type: Number, default: 0 },
      imageUrl: { type: String, default: '' },
    },
    isRead: { type: Boolean, default: false },
    reported: { type: Boolean, default: false, index: true },
    moderationStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'REVIEWED', 'DISMISSED'],
      default: 'NONE',
    },
    reports: {
      type: [
        {
          reportedBy: { type: String, required: true },
          reason: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
